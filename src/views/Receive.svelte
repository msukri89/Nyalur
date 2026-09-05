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

<div class="nv-min-h-screen nv-flex nv-flex-col nv-px-4 nv-py-6 nv-max-w-lg nv-mx-auto">
  <div class="nv-flex nv-items-center nv-gap-3 nv-mb-6">
    <button on:click={() => dispatch('back')} class="nv-w-10 nv-h-10 nv-rounded-xl nv-bg-nyalur-surface nv-flex nv-items-center nv-justify-center nv-hover-bg-nyalur-border nv-transition-colors nv-active-scale-95">
      <svg class="nv-w-5 nv-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
    </button>
    <h1 class="nv-text-xl nv-font-bold nv-text-nyalur-orange">TERIMA FILE</h1>
    {#if peerState?.status === 'connected'}<span class="nv-ml-auto nv-text-xs nv-text-nyalur-orange-60 nv-flex nv-items-center nv-gap-1"><span class="nv-w-1-5 nv-h-1-5 nv-rounded-full nv-bg-nyalur-orange"></span>Siap</span>{/if}
  </div>

  <div class="nv-flex nv-justify-center nv-mb-4">
    {#if editingName}
      <div class="nv-flex nv-items-center nv-gap-2">
        <input type="text" bind:value={nameInput} bind:this={nameInputEl} on:keydown={handleNameKey} on:blur={saveName} maxlength="20" class="nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-lg nv-px-3 nv-py-1-5 nv-text-sm nv-text-center nv-text-nyalur-text nv-focus-outline-none nv-focus-border-nyalur-orange-50 nv-w-44 nv-font-mono" />
        <button on:click={saveName} class="nv-text-nyalur-orange nv-text-sm nv-font-medium">OK</button>
      </div>
    {:else}
      <button on:click={startEditName} class="nv-text-nyalur-muted-60 nv-text-xs nv-flex nv-items-center nv-gap-1-5 nv-hover-text-nyalur-muted nv-transition-colors">
        <svg class="nv-w-3 nv-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        {deviceName || 'Perangkat'}
        <svg class="nv-w-3 nv-h-3 nv-opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
    {/if}
  </div>

  <div class="nv-flex-1 nv-flex nv-flex-col nv-items-center">
    {#if state === 'waiting'}
      {#if peerState?.status === 'connecting'}
        <div class="nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center"><div class="nv-w--220px nv-h--220px nv-bg-nyalur-surface nv-rounded-2xl nv-animate-pulse nv-mb-6"></div><p class="nv-text-nyalur-muted nv-text-sm">Menghubungkan ke server...</p></div>
      {:else if peerState?.status === 'connected'}
        <div class="nv-text-center nv-w-full">
          <p class="nv-text-xs nv-text-nyalur-muted nv-uppercase nv-tracking--0-25em nv-mb-3">KODE ROOM</p>
          <div class="nv-mb-3"><span class="nv-text-5xl nv-md-text-6xl nv-font-black nv-tracking--0-4em nv-text-nyalur-orange nv-font-mono nv-select-all">{spacedCode}</span></div>
          <p class="nv-text-sm nv-text-nyalur-muted-70 nv-mb-5">Berikan kode ini ke pengirim</p>
          <button on:click={copyRoomCode} class="nv-inline-flex nv-items-center nv-gap-2 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-px-4 nv-py-2-5 nv-hover-border-nyalur-orange-50 nv-transition-all nv-active-scale-95 nv-mb-6">
            {#if copied}<svg class="nv-w-4 nv-h-4 nv-text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg><span class="nv-text-sm nv-text-nyalur-green nv-font-medium">Tersalin!</span>
            {:else}<svg class="nv-w-4 nv-h-4 nv-text-nyalur-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span class="nv-text-sm nv-text-nyalur-muted nv-font-medium">Salin Kode</span>{/if}
          </button>
          {#if qrDataUrl}<div class="nv-flex nv-justify-center nv-mb-6"><div class="nv-bg-nyalur-surface nv-rounded-2xl nv-p-3 nv-inline-block nv-border nv-border-nyalur-border"><img src={qrDataUrl} alt="QR Code room" class="nv-w--196px nv-h--196px nv-rounded-lg" /></div></div>{/if}
          <div class="nv-flex nv-items-center nv-gap-2 nv-justify-center nv-mb-2"><span class="nv-w-2 nv-h-2 nv-rounded-full nv-bg-nyalur-orange nv-animate-pulse"></span><p class="nv-text-sm nv-text-nyalur-muted">Menunggu koneksi...</p></div>
        </div>
      {:else if peerState?.status === 'error'}
        <div class="nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center nv-text-center">
          <div class="nv-w-20 nv-h-20 nv-rounded-full nv-bg-nyalur-error-15 nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-6"><svg class="nv-w-10 nv-h-10 nv-text-nyalur-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
          <p class="nv-text-nyalur-error nv-text-sm nv-mb-4">{peerState.error}</p>
          <button on:click={() => dispatch('back')} class="nv-px-6 nv-py-2-5 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-hover-bg-nyalur-border nv-transition-colors nv-text-sm nv-active-scale-95">Kembali</button>
        </div>
      {/if}

    {:else if state === 'incoming'}
      <div class="nv-w-full nv-text-center">
        <div class="nv-w-16 nv-h-16 nv-rounded-full nv-bg-nyalur-orange-15 nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-4 nv-animate-pulse-orange"><svg class="nv-w-8 nv-h-8 nv-text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg></div>
        <h2 class="nv-text-lg nv-font-bold nv-mb-1">Transfer Masuk</h2>
        <p class="nv-text-sm nv-text-nyalur-muted nv-mb-4">dari <span class="nv-text-nyalur-orange nv-font-medium">{offer?.deviceName || 'Pengirim'}</span></p>
        <div class="nv-bg-nyalur-surface nv-rounded-xl nv-p-4 nv-mb-6 nv-text-left">
          {#if offer?.files}{#each offer.files as file}<div class="nv-flex nv-items-center nv-gap-2 nv-py-1-5"><svg class="nv-w-4 nv-h-4 nv-text-nyalur-muted nv-flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span class="nv-text-sm nv-truncate nv-flex-1">{file.name}</span><span class="nv-text-xs nv-text-nyalur-muted nv-flex-shrink-0">{formatFileSize(file.size)}</span></div>{/each}{/if}
          <div class="nv-border-t nv-border-nyalur-border nv-mt-2 nv-pt-2 nv-text-right"><span class="nv-text-xs nv-text-nyalur-muted nv-font-medium">Total: {formatFileSize(offer?.totalSize || 0)}</span></div>
        </div>
        <div class="nv-flex nv-gap-3 nv-justify-center">
          <button on:click={rejectTransfer} class="nv-flex-1 nv-max-w--140px nv-py-3 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-hover-bg-nyalur-border nv-transition-colors nv-text-sm nv-active-scale-95">Tolak</button>
          <button on:click={acceptTransfer} class="nv-flex-1 nv-max-w--140px nv-py-3 nv-bg-nyalur-orange nv-text-nyalur-bg nv-font-bold nv-rounded-xl nv-hover-bg-nyalur-orange-90 nv-transition-colors nv-text-sm nv-active-scale-95">Terima</button>
        </div>
      </div>

    {:else if state === 'receiving'}
      <div class="nv-w-full nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center nv-text-center">
        <div class="nv-w-24 nv-h-24 nv-rounded-full nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-6 nv-relative">
          <svg class="nv-absolute nv-w-24 nv-h-24 -rotate-90" viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" fill="none" stroke="#334155" stroke-width="4" /><circle cx="48" cy="48" r="42" fill="none" stroke="#FF6B00" stroke-width="4" stroke-dasharray="263.9" stroke-dashoffset="{263.9 * (1 - progress.totalProgress)}" stroke-linecap="round" class="nv-transition-all nv-duration-500" /></svg>
          <span class="nv-text-nyalur-orange nv-font-bold nv-text-xl">{Math.round(progress.totalProgress * 100)}%</span>
        </div>
        <p class="nv-text-sm nv-text-nyalur-text nv-mb-1 nv-truncate nv-w-full nv-px-8">{progress.fileName}</p>
        <div class="nv-w-full nv-bg-nyalur-surface nv-rounded-full nv-h-1-5 nv-mb-3"><div class="nv-bg-nyalur-orange nv-h-1-5 nv-rounded-full nv-transition-all nv-duration-500" style="width: {progress.totalProgress * 100}%"></div></div>
        <div class="nv-flex nv-justify-between nv-text-xs nv-text-nyalur-muted nv-w-full"><span>{formatFileSize(progress.totalReceived)} / {formatFileSize(progress.totalSize)}</span><span>{formatSpeed(progress.speed)}</span></div>
        {#if progress.speed > 0}<p class="nv-text-xs nv-text-nyalur-muted-60 nv-mt-2">~{formatTime((progress.totalSize - progress.totalReceived) / progress.speed)} lagi</p>{/if}
      </div>

    {:else if state === 'complete'}
      <div class="nv-w-full nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center nv-text-center">
        <div class="nv-w-20 nv-h-20 nv-rounded-full nv-bg-nyalur-orange-15 nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-6"><svg class="nv-w-10 nv-h-10 nv-text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></div>
        <h2 class="nv-text-2xl nv-font-bold nv-text-nyalur-orange nv-mb-2">Diterima!</h2>
        {#if transferResult}
          <p class="nv-text-sm nv-text-nyalur-muted nv-mb-1">{transferResult.files.length} file ({formatFileSize(transferResult.totalSize)}) dalam {formatTime(transferResult.duration / 1000)}</p>
          <p class="nv-text-xs nv-text-nyalur-muted-50 nv-mb-4">Kecepatan rata-rata: {formatSpeed(transferResult.avgSpeed || 0)}</p>
        {/if}
        <div class="nv-bg-nyalur-surface nv-rounded-xl nv-p-4 nv-mb-6 nv-text-left nv-w-full">
          {#each receivedFiles as file}<div class="nv-flex nv-items-center nv-gap-2 nv-py-2"><svg class="nv-w-4 nv-h-4 nv-text-nyalur-green nv-flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg><span class="nv-text-sm nv-truncate nv-flex-1">{file.name}</span><button on:click={() => handleDownload(file)} class="nv-text-xs nv-text-nyalur-orange nv-hover-underline nv-flex-shrink-0 nv-font-medium">Unduh</button></div>{/each}
        </div>
        <button on:click={reset} class="nv-px-8 nv-py-3 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-hover-bg-nyalur-border nv-transition-colors nv-text-sm nv-active-scale-95">Terima Lagi</button>
      </div>

    {:else if state === 'error'}
      <div class="nv-w-full nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center nv-text-center">
        <div class="nv-w-20 nv-h-20 nv-rounded-full nv-bg-nyalur-error-15 nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-6"><svg class="nv-w-10 nv-h-10 nv-text-nyalur-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
        <h2 class="nv-text-xl nv-font-bold nv-text-nyalur-error nv-mb-2">Error</h2>
        <p class="nv-text-sm nv-text-nyalur-muted nv-mb-6 nv-px-4">{errorMessage}</p>
        <button on:click={() => { reset(); dispatch('back'); }} class="nv-px-8 nv-py-3 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-hover-bg-nyalur-border nv-transition-colors nv-text-sm nv-active-scale-95">Kembali</button>
      </div>
    {/if}
  </div>
</div>
