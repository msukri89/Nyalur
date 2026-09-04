import { writable } from 'svelte/store';
import Peer from 'peerjs';

const ROOM_PREFIX = 'nyalur-';

// Characters that are easy to read/say aloud (no I/O/0/1 confusion)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createPeerManager() {
  const { subscribe, set, update } = writable({
    peer: null,
    peerId: null,
    roomCode: null,
    status: 'disconnected',
    connections: [],
    error: null,
    deviceName: ''
  });

  let peerInstance = null;
  let incomingCallback = null;

  function getDeviceName() {
    if (typeof window === 'undefined') return 'Perangkat';
    const stored = localStorage.getItem('nyalur-device-name');
    if (stored) return stored;

    const ua = navigator.userAgent;
    let name = 'Perangkat';
    if (/Android/i.test(ua)) name = 'HP-Android';
    else if (/iPhone/i.test(ua)) name = 'iPhone';
    else if (/iPad/i.test(ua)) name = 'iPad';
    else if (/Mac/i.test(ua)) name = 'Mac';
    else if (/Windows/i.test(ua)) name = 'PC-Windows';
    else if (/Linux/i.test(ua)) name = 'PC-Linux';

    name += '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    localStorage.setItem('nyalur-device-name', name);
    return name;
  }

  function setDeviceName(name) {
    if (typeof window !== 'undefined' && name) {
      const trimmed = name.trim().substring(0, 20);
      localStorage.setItem('nyalur-device-name', trimmed);
      update(s => ({ ...s, deviceName: trimmed }));
    }
  }

  function generateRoomCode() {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
  }

  const peerConfig = {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  };

  /**
   * Initialize as SENDER (random peer ID)
   */
  function init() {
    return new Promise((resolve, reject) => {
      _cleanup();
      const deviceName = getDeviceName();
      update(s => ({ ...s, status: 'connecting', error: null, deviceName, roomCode: null }));

      peerInstance = new Peer(peerConfig);
      _bindEvents(peerInstance, resolve, reject);
    });
  }

  /**
   * Initialize as RECEIVER with a short room code
   * Peer ID = 'nyalur-XXXX' where XXXX is the room code
   */
  function initAsReceiver(retries = 3) {
    return new Promise((resolve, reject) => {
      _cleanup();
      const deviceName = getDeviceName();
      const roomCode = generateRoomCode();
      const peerId = ROOM_PREFIX + roomCode;

      update(s => ({ ...s, status: 'connecting', error: null, deviceName, roomCode }));

      peerInstance = new Peer(peerId, peerConfig);

      peerInstance.on('open', (id) => {
        update(s => ({ ...s, peer: peerInstance, peerId: id, roomCode, status: 'connected' }));
        resolve({ peerId: id, roomCode });
      });

      peerInstance.on('error', (err) => {
        // If room code is taken, retry with a new one
        if (err.type === 'unavailable-id' && retries > 0) {
          console.log('Room code taken, retrying...');
          peerInstance.destroy();
          peerInstance = null;
          initAsReceiver(retries - 1).then(resolve).catch(reject);
          return;
        }
        console.error('PeerJS error:', err);
        update(s => ({ ...s, status: 'error', error: err.message || String(err) }));
        reject(err);
      });

      peerInstance.on('disconnected', () => {
        update(s => ({ ...s, status: 'disconnected' }));
        if (peerInstance && !peerInstance.destroyed) {
          setTimeout(() => {
            try { peerInstance.reconnect(); } catch (e) { /* ignore */ }
          }, 3000);
        }
      });

      peerInstance.on('connection', (conn) => {
        conn.on('open', () => {
          update(s => ({ ...s, connections: [...s.connections, conn] }));
          if (incomingCallback) incomingCallback(conn);
        });
      });

      // Timeout
      setTimeout(() => {
        update(s => {
          if (s.status === 'connecting') {
            reject(new Error('Timeout: tidak bisa terhubung ke server'));
            return { ...s, status: 'error', error: 'Timeout koneksi' };
          }
          return s;
        });
      }, 20000);
    });
  }

  /**
   * Connect to a receiver by room code (4 chars)
   */
  function connectToRoom(roomCode) {
    const code = roomCode.toUpperCase().trim();
    const remotePeerId = ROOM_PREFIX + code;
    return connectTo(remotePeerId);
  }

  /**
   * Connect to a peer by full peer ID
   */
  function connectTo(remotePeerId) {
    if (!peerInstance) throw new Error('Peer belum diinisialisasi');

    const conn = peerInstance.connect(remotePeerId, {
      reliable: true,
      serialization: 'binary'
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tidak ditemukan. Pastikan kode room benar dan penerima sudah siap.'));
      }, 15000);

      conn.on('open', () => {
        clearTimeout(timeout);
        update(s => ({ ...s, connections: [...s.connections, conn] }));
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('Koneksi gagal: ' + (err.message || err)));
      });
    });
  }

  function _bindEvents(peer, resolve, reject) {
    peer.on('open', (id) => {
      update(s => ({ ...s, peer: peer, peerId: id, status: 'connected' }));
      resolve(id);
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      update(s => ({ ...s, status: 'error', error: err.message || String(err) }));
      reject(err);
    });

    peer.on('disconnected', () => {
      update(s => ({ ...s, status: 'disconnected' }));
      if (peerInstance && !peerInstance.destroyed) {
        setTimeout(() => {
          try { peerInstance.reconnect(); } catch (e) { /* ignore */ }
        }, 3000);
      }
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        update(s => ({ ...s, connections: [...s.connections, conn] }));
        if (incomingCallback) incomingCallback(conn);
      });
    });

    setTimeout(() => {
      update(s => {
        if (s.status === 'connecting') {
          reject(new Error('Timeout: tidak bisa terhubung ke server'));
          return { ...s, status: 'error', error: 'Timeout koneksi' };
        }
        return s;
      });
    }, 20000);
  }

  function _cleanup() {
    if (peerInstance) {
      peerInstance.destroy();
      peerInstance = null;
    }
  }

  function onIncomingConnection(callback) {
    incomingCallback = callback;
  }

  function destroy() {
    incomingCallback = null;
    _cleanup();
    set({
      peer: null,
      peerId: null,
      roomCode: null,
      status: 'disconnected',
      connections: [],
      error: null,
      deviceName: ''
    });
  }

  return {
    subscribe, init, initAsReceiver, connectTo, connectToRoom,
    onIncomingConnection, destroy, getDeviceName, setDeviceName,
    generateRoomCode
  };
}

export const peerManager = createPeerManager();
