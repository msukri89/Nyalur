<script>
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { peerManager } from '../lib/peer-manager.js';
  import { receiveFiles, downloadFile, requestNotificationPermission } from '../lib/transfer-engine.js';
  import { addTransfer } from '../lib/history-db.js';
  import { formatFileSize, formatSpeed, formatTime } from '../lib/utils.js';
  import QRCode from 'qrcode';

  const dispatch = createEventDispatcher();

  let state = 'waiting';
  let errorMessage = '';
  let qrDataUrl = '';
  let copied = false;
  let offer = null;
  let receiver = null;
  let receivedFiles = [];
  let transferResult = null;
  let deviceName = '';
  let editingName = false;
  let nameInput = '';
  let nameInputEl;

  let progress = {
    fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0,
    totalReceived: 0, totalSize: 0, speed: 0, elapsed: 0
  };

  let peerState;
  const unsubscribe = peerManager.subscribe(s => peerState = s);
  $: roomCode = peerState?.roomCode || '';
  $: spacedCode = roomCode ? roomCode.split('').join(' ') : '';

  onMount(async () => {
    deviceName = localStorage.getItem('nyalur-device-name') || '';
    try {
      const result = await peerManager.initAsReceiver();
      await generateQR(result.roomCode);
      peerManager.onIncomingConnection(handleIncomingConnection);
      requestNotificationPermission();
    } catch (e) {
      errorMessage = 'Gagal terhubung ke server: ' + (e.message || e);
      state = 'error';
    }
  });

  onDestroy(() => { unsubscribe(); peerManager.destroy(); });

  async function generateQR(code) {
    try { qrDataUrl = await QRCode.toDataURL(code, { width: 220, margin: 2, color: { dark: '#FF6B00', light: '#0F172A' }, errorCorrectionLevel: 'M' }); }
    catch (e) { console.error('QR generation failed:', e); }
  }

  function handleIncomingConnection(conn) {
    receiver = receiveFiles(conn,
      (offerData) => { offer = offerData; state = 'incoming'; },
      (p) => { progress = p; },
      (fileInfo, blob) => { receivedFiles = [...receivedFiles, { ...fileInfo, blob }]; },
      async (result) => {
        transferResult = result; state = 'complete';
        await addTransfer({ direction: 'received', peerName: offer?.deviceName || 'Unknown', files: result.files.map(f => ({ name: f.name || '', size: f.size || 0 })), totalSize: result.totalSize, duration: result.duration, status: 'completed' });
      }
    );
  }

  function acceptTransfer() { if (receiver) { receiver.accept(); state = 'receiving'; } }
  function rejectTransfer() { if (receiver) { receiver.reject(); state = 'waiting'; offer = null; receiver = null; } }

  async function copyRoomCode() {
    if (roomCode) {
      try { await navigator.clipboard.writeText(roomCode); copied = true; setTimeout(() => copied = false, 2000); }
      catch { const el = document.createElement('textarea'); el.value = roomCode; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); copied = true; setTimeout(() => copied = false, 2000); }
    }
  }

  function handleDownload(file) { downloadFile(file.blob, file.name); }
  async function startEditName() { nameInput = deviceName; editingName = true; await tick(); if (nameInputEl) nameInputEl.focus(); }
  function saveName() { const trimmed = nameInput.trim().substring(0, 20); if (trimmed) { deviceName = trimmed; localStorage.setItem('nyalur-device-name', trimmed); peerManager.setDeviceName(trimmed); } editingName = false; }
  function handleNameKey(e) { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') editingName = false; }
  function reset() { state = 'waiting'; offer = null; receiver = null; receivedFiles = []; transferResult = null; errorMessage = ''; progress = { fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0, totalReceived: 0, totalSize: 0, speed: 0, elapsed: 0 }; peerManager.onIncomingConnection(handleIncomingConnection); }
</script>

<div class="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
  <div class="flex items-center gap-3 mb-6">
    <button on:click={() => dispatch('back')} class="w-10 h-10 rounded-xl bg-nyalur-surface flex items-center justify-center hover:bg-nyalur-border transition-colors active:scale-95">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
    </button>
    <h1 class="text-xl font-bold text-nyalur-orange">TERIMA FILE</h1>
    {#if peerState?.status === 'connected'}<span class="ml-auto text-xs text-nyalur-orange/60 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-nyalur-orange"></span>Siap</span>{/if}
  </div>

  <div class="flex justify-center mb-4">
    {#if editingName}
      <div class="flex items-center gap-2">
        <input type="text" bind:value={nameInput} bind:this={nameInputEl} on:keydown={handleNameKey} on:blur={saveName} maxlength="20" class="bg-nyalur-surface border border-nyalur-border rounded-lg px-3 py-1.5 text-sm text-center text-nyalur-text focus:outline-none focus:border-nyalur-orange/50 w-44 font-mono" />
        <button on:click={saveName} class="text-nyalur-orange text-sm font-medium">OK</button>
      </div>
    {:else}
      <button on:click={startEditName} class="text-nyalur-muted/60 text-xs flex items-center gap-1.5 hover:text-nyalur-muted transition-colors">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        {deviceName || 'Perangkat'}
        <svg class="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
    {/if}
  </div>

  <div class="flex-1 flex flex-col items-center">
    {#if state === 'waiting'}
      {#if peerState?.status === 'connecting'}
        <div class="flex-1 flex flex-col items-center justify-center"><div class="w-[220px] h-[220px] bg-nyalur-surface rounded-2xl animate-pulse mb-6"></div><p class="text-nyalur-muted text-sm">Menghubungkan ke server...</p></div>
      {:else if peerState?.status === 'connected'}
        <div class="text-center w-full">
          <p class="text-xs text-nyalur-muted uppercase tracking-[0.25em] mb-3">KODE ROOM</p>
          <div class="mb-3"><span class="text-5xl md:text-6xl font-black tracking-[0.4em] text-nyalur-orange font-mono select-all">{spacedCode}</span></div>
          <p class="text-sm text-nyalur-muted/70 mb-5">Berikan kode ini ke pengirim</p>
          <button on:click={copyRoomCode} class="inline-flex items-center gap-2 bg-nyalur-surface border border-nyalur-border rounded-xl px-4 py-2.5 hover:border-nyalur-orange/50 transition-all active:scale-95 mb-6">
            {#if copied}<svg class="w-4 h-4 text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg><span class="text-sm text-nyalur-green font-medium">Tersalin!</span>
            {:else}<svg class="w-4 h-4 text-nyalur-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span class="text-sm text-nyalur-muted font-medium">Salin Kode</span>{/if}
          </button>
          {#if qrDataUrl}<div class="flex justify-center mb-6"><div class="bg-nyalur-surface rounded-2xl p-3 inline-block border border-nyalur-border"><img src={qrDataUrl} alt="QR Code room" class="w-[196px] h-[196px] rounded-lg" /></div></div>{/if}
          <div class="flex items-center gap-2 justify-center mb-2"><span class="w-2 h-2 rounded-full bg-nyalur-orange animate-pulse"></span><p class="text-sm text-nyalur-muted">Menunggu koneksi...</p></div>
        </div>
      {:else if peerState?.status === 'error'}
        <div class="flex-1 flex flex-col items-center justify-center text-center">
          <div class="w-20 h-20 rounded-full bg-nyalur-error/15 flex items-center justify-center mx-auto mb-6"><svg class="w-10 h-10 text-nyalur-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
          <p class="text-nyalur-error text-sm mb-4">{peerState.error}</p>
          <button on:click={() => dispatch('back')} class="px-6 py-2.5 bg-nyalur-surface border border-nyalur-border rounded-xl hover:bg-nyalur-border transition-colors text-sm active:scale-95">Kembali</button>
        </div>
      {/if}

    {:else if state === 'incoming'}
      <div class="w-full text-center">
        <div class="w-16 h-16 rounded-full bg-nyalur-orange/15 flex items-center justify-center mx-auto mb-4 animate-pulse-orange"><svg class="w-8 h-8 text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg></div>
        <h2 class="text-lg font-bold mb-1">Transfer Masuk</h2>
        <p class="text-sm text-nyalur-muted mb-4">dari <span class="text-nyalur-orange font-medium">{offer?.deviceName || 'Pengirim'}</span></p>
        <div class="bg-nyalur-surface rounded-xl p-4 mb-6 text-left">
          {#if offer?.files}{#each offer.files as file}<div class="flex items-center gap-2 py-1.5"><svg class="w-4 h-4 text-nyalur-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span class="text-sm truncate flex-1">{file.name}</span><span class="text-xs text-nyalur-muted flex-shrink-0">{formatFileSize(file.size)}</span></div>{/each}{/if}
          <div class="border-t border-nyalur-border mt-2 pt-2 text-right"><span class="text-xs text-nyalur-muted font-medium">Total: {formatFileSize(offer?.totalSize || 0)}</span></div>
        </div>
        <div class="flex gap-3 justify-center">
          <button on:click={rejectTransfer} class="flex-1 max-w-[140px] py-3 bg-nyalur-surface border border-nyalur-border rounded-xl hover:bg-nyalur-border transition-colors text-sm active:scale-95">Tolak</button>
          <button on:click={acceptTransfer} class="flex-1 max-w-[140px] py-3 bg-nyalur-orange text-nyalur-bg font-bold rounded-xl hover:bg-nyalur-orange/90 transition-colors text-sm active:scale-95">Terima</button>
        </div>
      </div>

    {:else if state === 'receiving'}
      <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <svg class="absolute w-24 h-24 -rotate-90" viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" fill="none" stroke="#334155" stroke-width="4" /><circle cx="48" cy="48" r="42" fill="none" stroke="#FF6B00" stroke-width="4" stroke-dasharray="263.9" stroke-dashoffset="{263.9 * (1 - progress.totalProgress)}" stroke-linecap="round" class="transition-all duration-500" /></svg>
          <span class="text-nyalur-orange font-bold text-xl">{Math.round(progress.totalProgress * 100)}%</span>
        </div>
        <p class="text-sm text-nyalur-text mb-1 truncate w-full px-8">{progress.fileName}</p>
        <div class="w-full bg-nyalur-surface rounded-full h-1.5 mb-3"><div class="bg-nyalur-orange h-1.5 rounded-full transition-all duration-500" style="width: {progress.totalProgress * 100}%"></div></div>
        <div class="flex justify-between text-xs text-nyalur-muted w-full"><span>{formatFileSize(progress.totalReceived)} / {formatFileSize(progress.totalSize)}</span><span>{formatSpeed(progress.speed)}</span></div>
        {#if progress.speed > 0}<p class="text-xs text-nyalur-muted/60 mt-2">~{formatTime((progress.totalSize - progress.totalReceived) / progress.speed)} lagi</p>{/if}
      </div>

    {:else if state === 'complete'}
      <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-full bg-nyalur-orange/15 flex items-center justify-center mx-auto mb-6"><svg class="w-10 h-10 text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></div>
        <h2 class="text-2xl font-bold text-nyalur-orange mb-2">Diterima!</h2>
        {#if transferResult}
          <p class="text-sm text-nyalur-muted mb-1">{transferResult.files.length} file ({formatFileSize(transferResult.totalSize)}) dalam {formatTime(transferResult.duration / 1000)}</p>
          <p class="text-xs text-nyalur-muted/50 mb-4">Kecepatan rata-rata: {formatSpeed(transferResult.avgSpeed || 0)}</p>
        {/if}
        <div class="bg-nyalur-surface rounded-xl p-4 mb-6 text-left w-full">
          {#each receivedFiles as file}<div class="flex items-center gap-2 py-2"><svg class="w-4 h-4 text-nyalur-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg><span class="text-sm truncate flex-1">{file.name}</span><button on:click={() => handleDownload(file)} class="text-xs text-nyalur-orange hover:underline flex-shrink-0 font-medium">Unduh</button></div>{/each}
        </div>
        <button on:click={reset} class="px-8 py-3 bg-nyalur-surface border border-nyalur-border rounded-xl hover:bg-nyalur-border transition-colors text-sm active:scale-95">Terima Lagi</button>
      </div>

    {:else if state === 'error'}
      <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-full bg-nyalur-error/15 flex items-center justify-center mx-auto mb-6"><svg class="w-10 h-10 text-nyalur-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
        <h2 class="text-xl font-bold text-nyalur-error mb-2">Error</h2>
        <p class="text-sm text-nyalur-muted mb-6 px-4">{errorMessage}</p>
        <button on:click={() => { reset(); dispatch('back'); }} class="px-8 py-3 bg-nyalur-surface border border-nyalur-border rounded-xl hover:bg-nyalur-border transition-colors text-sm active:scale-95">Kembali</button>
      </div>
    {/if}
  </div>
</div>
