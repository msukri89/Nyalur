import Peer from 'peerjs';

const ROOM_PREFIX = 'nyalur-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createPeerManager() {
  let state = { peer:null, peerId:null, roomCode:null, status:'disconnected', connections:[], error:null, deviceName:'' };
  const listeners = new Set();
  let peerInstance = null;
  let incomingCallback = null;

  function notify() { listeners.forEach(fn => fn({...state})); }
  function update(patch) { state = {...state, ...patch}; notify(); }
  function subscribe(fn) { listeners.add(fn); fn({...state}); return () => listeners.delete(fn); }

  function getDeviceName() {
    const stored = localStorage.getItem('nyalur-device-name');
    if (stored) return stored;
    const ua = navigator.userAgent;
    let name='Perangkat';
    if (/Android/i.test(ua)) name='HP-Android'; else if (/iPhone/i.test(ua)) name='iPhone'; else if (/iPad/i.test(ua)) name='iPad'; else if (/Mac/i.test(ua)) name='Mac'; else if (/Windows/i.test(ua)) name='PC-Windows'; else if (/Linux/i.test(ua)) name='PC-Linux';
    name += '-' + Math.random().toString(36).substring(2,6).toUpperCase();
    localStorage.setItem('nyalur-device-name', name); return name;
  }
  function setDeviceName(name) { const trimmed=(name||'').trim().substring(0,20); if(trimmed){localStorage.setItem('nyalur-device-name',trimmed); update({deviceName:trimmed});} }
  function generateRoomCode(){let code=''; for(let i=0;i<4;i++) code+=CODE_CHARS.charAt(Math.floor(Math.random()*CODE_CHARS.length)); return code;}
  const peerConfig={debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:stun2.l.google.com:19302'}]}};

  function cleanup(){if(peerInstance){try{peerInstance.destroy();}catch{} peerInstance=null;}}
  function init(){return new Promise((resolve,reject)=>{cleanup(); const deviceName=getDeviceName(); update({status:'connecting',error:null,deviceName,roomCode:null}); peerInstance=new Peer(peerConfig); bindEvents(peerInstance,resolve,reject);});}
  function initAsReceiver(retries=3){return new Promise((resolve,reject)=>{cleanup(); const deviceName=getDeviceName(); const roomCode=generateRoomCode(); const peerId=ROOM_PREFIX+roomCode; update({status:'connecting',error:null,deviceName,roomCode}); peerInstance=new Peer(peerId,peerConfig);
    peerInstance.on('open',id=>{update({peer:peerInstance,peerId:id,roomCode,status:'connected'});resolve({peerId:id,roomCode});});
    peerInstance.on('error',err=>{if(err.type==='unavailable-id'&&retries>0){cleanup();initAsReceiver(retries-1).then(resolve).catch(reject);return;} update({status:'error',error:err.message||String(err)});reject(err);});
    peerInstance.on('disconnected',()=>{update({status:'disconnected'});if(peerInstance&&!peerInstance.destroyed)setTimeout(()=>{try{peerInstance.reconnect();}catch{}},3000);});
    peerInstance.on('connection',conn=>{conn.on('open',()=>{update({connections:[...state.connections,conn]});if(incomingCallback)incomingCallback(conn);});});
    setTimeout(()=>{if(state.status==='connecting'){const e=new Error('Timeout: tidak bisa terhubung ke server');update({status:'error',error:'Timeout koneksi'});reject(e);}},20000);
  });}
  function bindEvents(peer,resolve,reject){
    peer.on('open',id=>{update({peer,peerId:id,status:'connected'});resolve(id);});
    peer.on('error',err=>{update({status:'error',error:err.message||String(err)});reject(err);});
    peer.on('disconnected',()=>{update({status:'disconnected'});if(peerInstance&&!peerInstance.destroyed)setTimeout(()=>{try{peerInstance.reconnect();}catch{}},3000);});
    peer.on('connection',conn=>{conn.on('open',()=>{update({connections:[...state.connections,conn]});if(incomingCallback)incomingCallback(conn);});});
    setTimeout(()=>{if(state.status==='connecting'){const e=new Error('Timeout: tidak bisa terhubung ke server');update({status:'error',error:'Timeout koneksi'});reject(e);}},20000);
  }
  function connectToRoom(code){return connectTo(ROOM_PREFIX+code.toUpperCase().trim());}
  function connectTo(remotePeerId){if(!peerInstance)throw new Error('Peer belum diinisialisasi'); const conn=peerInstance.connect(remotePeerId,{reliable:true,serialization:'binary'}); return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Tidak ditemukan. Pastikan kode room benar dan penerima sudah siap.')),15000); conn.on('open',()=>{clearTimeout(timeout);update({connections:[...state.connections,conn]});resolve(conn);});conn.on('error',err=>{clearTimeout(timeout);reject(new Error('Koneksi gagal: '+(err.message||err)));});});}
  function onIncomingConnection(cb){incomingCallback=cb;}
  function destroy(){incomingCallback=null;cleanup();state={peer:null,peerId:null,roomCode:null,status:'disconnected',connections:[],error:null,deviceName:''};notify();}
  return {subscribe,init,initAsReceiver,connectTo,connectToRoom,onIncomingConnection,destroy,getDeviceName,setDeviceName,generateRoomCode};
}
export const peerManager=createPeerManager();
