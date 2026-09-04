import { writable } from 'svelte/store';
import Peer from 'peerjs';

function createPeerManager() {
  const { subscribe, set, update } = writable({
    peer: null,
    peerId: null,
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

  function init() {
    return new Promise((resolve, reject) => {
      if (peerInstance) {
        peerInstance.destroy();
        peerInstance = null;
      }

      const deviceName = getDeviceName();
      update(s => ({ ...s, status: 'connecting', error: null, deviceName }));

      peerInstance = new Peer({
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      peerInstance.on('open', (id) => {
        update(s => ({ ...s, peer: peerInstance, peerId: id, status: 'connected' }));
        resolve(id);
      });

      peerInstance.on('error', (err) => {
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

  function connectTo(remotePeerId) {
    if (!peerInstance) throw new Error('Peer belum diinisialisasi');

    const conn = peerInstance.connect(remotePeerId, {
      reliable: true,
      serialization: 'binary'
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: tidak bisa terhubung ke penerima'));
      }, 15000);

      conn.on('open', () => {
        clearTimeout(timeout);
        update(s => ({ ...s, connections: [...s.connections, conn] }));
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  function onIncomingConnection(callback) {
    incomingCallback = callback;
  }

  function destroy() {
    incomingCallback = null;
    if (peerInstance) {
      peerInstance.destroy();
      peerInstance = null;
    }
    set({
      peer: null,
      peerId: null,
      status: 'disconnected',
      connections: [],
      error: null,
      deviceName: ''
    });
  }

  return { subscribe, init, connectTo, onIncomingConnection, destroy, getDeviceName };
}

export const peerManager = createPeerManager();
