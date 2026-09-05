<script>
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { peerManager } from '../lib/peer-manager.js';
  import { sendFiles, requestNotificationPermission } from '../lib/transfer-engine.js';
  import { addTransfer } from '../lib/history-db.js';
  import { formatFileSize, formatSpeed, formatTime } from '../lib/utils.js';

  const dispatch = createEventDispatcher();

  let state = 'idle';
  let selectedFiles = [];
  let roomCode = '';
  let errorMessage = '';
  let result = null;
  let deviceName = '';
  let dragOver = false;
  let scanner = null;
  let scannerContainerId = 'qr-reader-' + Math.random().toString(36).substring(2, 8);

  let progress = {
    fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0,
    totalSent: 0, totalSize: 0, speed: 0, elapsed: 0
  };

  let peerState;
  const unsubscribe = peerManager.subscribe(s => peerState = s);

  onMount(async () => {
    try {
      await peerManager.init();
      deviceName = peerManager.getDeviceName();
      requestNotificationPermission();
    } catch (e) {
      errorMessage = 'Gagal terhubung ke server: ' + (e.message || e);
      state = 'error';
    }
  });

  onDestroy(() => { unsubscribe(); stopScanner(); peerManager.destroy(); });

  function handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) selectedFiles = [...selectedFiles, ...Array.from(files)];
    event.target.value = '';
  }
  function handleDragOver(event) { event.preventDefault(); dragOver = true; }
  function handleDragLeave() { dragOver = false; }
  function handleDrop(event) {
    event.preventDefault(); dragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) selectedFiles = [...selectedFiles, ...Array.from(files)];
  }
  function removeFile(index) { selectedFiles = selectedFiles.filter((_, i) => i !== index); }
  function handleRoomCodeInput(event) { roomCode = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4); }

  async function startScanner() {
    state = 'scanning'; await tick();
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      scanner = new Html5Qrcode(scannerContainerId);
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1.0 },
        (decodedText) => {
          let code = decodedText.trim();
          if (code.startsWith('nyalur-')) code = code.replace('nyalur-', '');
          code = code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
          if (code.length === 4) { roomCode = code; stopScanner(); connect(); }
        }, () => {});
    } catch (e) { console.error('Scanner error:', e); errorMessage = 'Tidak bisa membuka kamera: ' + (e.message || e); state = 'idle'; scanner = null; }
  }
  async function stopScanner() {
    if (scanner) { try { await scanner.stop(); scanner.clear(); } catch {} scanner = null; }
    if (state === 'scanning') state = 'idle';
  }

  async function connect() {
    const code = roomCode.trim();
    if (!code || code.length !== 4 || selectedFiles.length === 0) return;
    state = 'connecting'; errorMessage = '';
    try {
      const conn = await peerManager.connectToRoom(code);
      state = 'transferring';
      const transferResult = await sendFiles(conn, selectedFiles, (p) => { progress = p; });
      result = transferResult; state = 'complete';
      await addTransfer({ direction: 'sent', peerName: code, files: transferResult.files, totalSize: transferResult.totalSize, duration: transferResult.duration, status: 'completed' });
    } catch (e) {
      errorMessage = e.message || 'Transfer gagal'; state = 'error';
      await addTransfer({ direction: 'sent', peerName: code, files: selectedFiles.map(f => ({ name: f.name, size: f.size })), totalSize: selectedFiles.reduce((s, f) => s + f.size, 0), duration: progress.elapsed, status: 'failed' });
    }
  }

  function reset() { state = 'idle'; selectedFiles = []; roomCode = ''; errorMessage = ''; result = null; progress = { fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0, totalSent: 0, totalSize: 0, speed: 0, elapsed: 0 }; }
  function retry() { state = 'idle'; errorMessage = ''; result = null; progress = { fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0, totalSent: 0, totalSize: 0, speed: 0, elapsed: 0 }; }

  $: totalSelectedSize = selectedFiles.reduce((s, f) => s + f.size, 0);
  $: canSend = selectedFiles.length > 0 && roomCode.trim().length === 4 && state !== 'connecting';
  $: progressPercent = Math.round(progress.totalProgress * 100);
  $: progressOffset = 263.9 * (1 - progress.totalProgress);
</script>

<div class="nv-min-h-screen nv-flex nv-flex-col nv-px-4 nv-py-6 nv-max-w-lg nv-mx-auto">
  <div class="nv-flex nv-items-center nv-gap-3 nv-mb-6">
    <button on:click={() => dispatch('back')} class="nv-w-10 nv-h-10 nv-rounded-xl nv-bg-nyalur-surface nv-flex nv-items-center nv-justify-center nv-hover-bg-nyalur-border nv-transition-colors nv-active-scale-95">
      <svg class="nv-w-5 nv-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
    </button>
    <div class="nv-flex nv-flex-col"><h1 class="nv-text-xl nv-font-bold nv-text-nyalur-green">KIRIM FILE</h1>{#if deviceName}<span class="nv-text-xs nv-text-nyalur-muted-60">{deviceName}</span>{/if}</div>
    {#if peerState?.status === 'connected'}<span class="nv-ml-auto nv-text-xs nv-text-nyalur-green-60 nv-flex nv-items-center nv-gap-1"><span class="nv-w-1-5 nv-h-1-5 nv-rounded-full nv-bg-nyalur-green"></span>Online</span>{/if}
  </div>

  <div class="nv-flex-1 nv-flex nv-flex-col">
    {#if state === 'idle' || state === 'connecting'}
      <label class="nv-block nv-w-full nv-mb-4 nv-cursor-pointer" on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop}>
        <div class="nv-border-2 nv-border-dashed nv-rounded-xl nv-p-6 nv-text-center nv-transition-all nv-active-scale--0-98 {dragOver ? 'nv-border-nyalur-green nv-bg-nyalur-green/10' : 'nv-border-nyalur-border nv-hover-border-nyalur-green-50 nv-hover-bg-nyalur-green-5'}">
          <svg class="nv-w-10 nv-h-10 nv-text-nyalur-muted nv-mx-auto nv-mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          <p class="nv-text-nyalur-muted nv-text-sm nv-font-medium">{dragOver ? 'Lepaskan file di sini' : 'Tap untuk pilih file'}</p>
          <p class="nv-text-nyalur-muted-40 nv-text-xs nv-mt-1">Foto, video, dokumen — semua jenis file</p>
        </div>
        <input type="file" multiple class="nv-hidden" on:change={handleFileSelect} />
      </label>

      {#if selectedFiles.length > 0}
        <div class="nv-space-y-2 nv-mb-6">
          {#each selectedFiles as file, i}
            <div class="nv-bg-nyalur-surface nv-rounded-xl nv-px-3 nv-py-2-5 nv-flex nv-items-center nv-gap-3">
              <div class="nv-w-8 nv-h-8 nv-rounded-lg nv-bg-nyalur-green-15 nv-flex nv-items-center nv-justify-center nv-flex-shrink-0">
                <svg class="nv-w-4 nv-h-4 nv-text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div class="nv-flex-1 nv-min-w-0"><p class="nv-text-sm nv-truncate">{file.name}</p><p class="nv-text-xs nv-text-nyalur-muted">{formatFileSize(file.size)}</p></div>
              <button on:click={() => removeFile(i)} class="nv-text-nyalur-muted nv-hover-text-nyalur-error nv-transition-colors nv-p-1"><svg class="nv-w-4 nv-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
          {/each}
          <p class="nv-text-xs nv-text-nyalur-muted nv-text-right">{selectedFiles.length} file · Total: {formatFileSize(totalSelectedSize)}</p>
        </div>
        <div class="nv-mb-4">
          <label class="nv-text-xs nv-text-nyalur-muted nv-uppercase nv-tracking-widest nv-mb-2 nv-block">Kode Room Penerima</label>
          <div class="nv-flex nv-gap-2 nv-items-center">
            <input type="text" value={roomCode} on:input={handleRoomCodeInput} placeholder="XXXX" maxlength="4" class="nv-flex-1 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-px-4 nv-py-3-5 nv-text-nyalur-text nv-placeholder-nyalur-muted-30 nv-focus-outline-none nv-focus-border-nyalur-green-50 nv-text-2xl nv-font-mono nv-tracking--0-3em nv-text-center nv-uppercase nv-disabled-opacity-50 nv-transition-colors" disabled={state === 'connecting'} />
            <button on:click={startScanner} disabled={state === 'connecting'} class="nv-w--52px nv-h--52px nv-flex-shrink-0 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-flex nv-items-center nv-justify-center nv-hover-border-nyalur-green-50 nv-hover-bg-nyalur-green-5 nv-active-scale-95 nv-disabled-opacity-30 nv-disabled-cursor-not-allowed nv-transition-all" title="Scan QR Code">
              <svg class="nv-w-6 nv-h-6 nv-text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5a2 2 0 012-2h2m0 16H5a2 2 0 01-2-2v-2m16-10V5a2 2 0 00-2-2h-2m0 16h2a2 2 0 002-2v-2" /><rect x="7" y="7" width="4" height="4" rx="0.5" fill="none" /><rect x="13" y="7" width="4" height="4" rx="0.5" fill="none" /><rect x="7" y="13" width="4" height="4" rx="0.5" fill="none" /></svg>
            </button>
          </div>
          <p class="nv-text-xs nv-text-nyalur-muted-40 nv-mt-2">Masukkan 4 karakter kode room, atau scan QR dari penerima</p>
        </div>
        <button on:click={connect} disabled={!canSend} class="nv-w-full nv-py-3-5 nv-bg-nyalur-green nv-text-nyalur-bg nv-font-bold nv-rounded-xl nv-hover-bg-nyalur-green-90 nv-active-scale--0-98 nv-disabled-opacity-30 nv-disabled-cursor-not-allowed nv-transition-all nv-text-sm nv-flex nv-items-center nv-justify-center nv-gap-2">
          {#if state === 'connecting'}<svg class="nv-w-5 nv-h-5 nv-animate-spin" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="nv-opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" class="nv-opacity-75" /></svg><span>Menghubungkan...</span>{:else}<svg class="nv-w-5 nv-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg><span>Kirim</span>{/if}
        </button>
      {/if}

    {:else if state === 'scanning'}
      <div class="nv-flex-1 nv-flex nv-flex-col nv-items-center">
        <div class="nv-w-full nv-mb-4">
          <div class="nv-flex nv-items-center nv-justify-between nv-mb-3">
            <p class="nv-text-sm nv-text-nyalur-muted nv-font-medium">Arahkan kamera ke QR Code</p>
            <button on:click={stopScanner} class="nv-w-8 nv-h-8 nv-rounded-lg nv-bg-nyalur-surface nv-flex nv-items-center nv-justify-center nv-hover-bg-nyalur-border nv-active-scale-95 nv-transition-colors"><svg class="nv-w-4 nv-h-4 nv-text-nyalur-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div class="nv-relative nv-w-full nv-aspect-square nv-max-w--320px nv-mx-auto nv-rounded-2xl nv-overflow-hidden nv-bg-nyalur-surface nv-border-2 nv-border-nyalur-green-30">
            <div id={scannerContainerId} class="nv-w-full nv-h-full"></div>
            <div class="nv-absolute nv-inset-0 nv-pointer-events-none">
              <div class="nv-absolute nv-top-4 nv-left-4 nv-w-8 nv-h-8 nv-border-t-2 nv-border-l-2 nv-border-nyalur-green nv-rounded-tl-lg"></div>
              <div class="nv-absolute nv-top-4 nv-right-4 nv-w-8 nv-h-8 nv-border-t-2 nv-border-r-2 nv-border-nyalur-green nv-rounded-tr-lg"></div>
              <div class="nv-absolute nv-bottom-4 nv-left-4 nv-w-8 nv-h-8 nv-border-b-2 nv-border-l-2 nv-border-nyalur-green nv-rounded-bl-lg"></div>
              <div class="nv-absolute nv-bottom-4 nv-right-4 nv-w-8 nv-h-8 nv-border-b-2 nv-border-r-2 nv-border-nyalur-green nv-rounded-br-lg"></div>
            </div>
          </div>
          <p class="nv-text-xs nv-text-nyalur-muted-40 nv-text-center nv-mt-3">Scan QR code yang tampil di layar penerima</p>
        </div>
        <button on:click={stopScanner} class="nv-mt-auto nv-w-full nv-py-3 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-hover-bg-nyalur-border nv-transition-colors nv-text-sm nv-active-scale-95">Batal</button>
      </div>

    {:else if state === 'transferring'}
      <div class="nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center nv-text-center">
        <div class="nv-w-28 nv-h-28 nv-rounded-full nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-6 nv-relative">
          <svg class="nv-absolute nv-w-28 nv-h-28 -rotate-90" viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" fill="none" stroke="#334155" stroke-width="4" /><circle cx="48" cy="48" r="42" fill="none" stroke="#39FF14" stroke-width="4" stroke-dasharray="263.9" stroke-dashoffset={progressOffset} stroke-linecap="round" class="nv-transition-all nv-duration-500" /></svg>
          <span class="nv-text-nyalur-green nv-font-bold nv-text-2xl">{progressPercent}%</span>
        </div>
        <p class="nv-text-sm nv-text-nyalur-text nv-mb-1 nv-truncate nv-w-full nv-px-8">{progress.fileName}</p>
        <p class="nv-text-xs nv-text-nyalur-muted nv-mb-4">File {progress.fileIndex + 1} dari {selectedFiles.length}</p>
        <div class="nv-w-full nv-bg-nyalur-surface nv-rounded-full nv-h-1-5 nv-mb-3"><div class="nv-bg-nyalur-green nv-h-1-5 nv-rounded-full nv-transition-all nv-duration-500" style="width: {progress.totalProgress * 100}%"></div></div>
        <div class="nv-flex nv-justify-between nv-text-xs nv-text-nyalur-muted nv-w-full"><span>{formatFileSize(progress.totalSent)} / {formatFileSize(progress.totalSize)}</span><span>{formatSpeed(progress.speed)}</span></div>
        {#if progress.speed > 0}<p class="nv-text-xs nv-text-nyalur-muted-60 nv-mt-2">~{formatTime((progress.totalSize - progress.totalSent) / progress.speed)} lagi</p>{/if}
      </div>

    {:else if state === 'complete'}
      <div class="nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center nv-text-center">
        <div class="nv-w-20 nv-h-20 nv-rounded-full nv-bg-nyalur-green-15 nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-6"><svg class="nv-w-10 nv-h-10 nv-text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></div>
        <h2 class="nv-text-2xl nv-font-bold nv-text-nyalur-green nv-mb-2">Berhasil!</h2>
        {#if result}
          <p class="nv-text-sm nv-text-nyalur-muted nv-mb-1">{result.files.length} file ({formatFileSize(result.totalSize)}) terkirim dalam {formatTime(result.duration / 1000)}</p>
          <p class="nv-text-xs nv-text-nyalur-muted-50">Kecepatan rata-rata: {formatSpeed(result.avgSpeed || 0)}</p>
        {/if}
        <button on:click={reset} class="nv-mt-8 nv-px-8 nv-py-3 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-hover-bg-nyalur-border nv-transition-colors nv-text-sm nv-active-scale-95">Kirim Lagi</button>
      </div>

    {:else if state === 'error'}
      <div class="nv-flex-1 nv-flex nv-flex-col nv-items-center nv-justify-center nv-text-center">
        <div class="nv-w-20 nv-h-20 nv-rounded-full nv-bg-nyalur-error-15 nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-6"><svg class="nv-w-10 nv-h-10 nv-text-nyalur-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
        <h2 class="nv-text-xl nv-font-bold nv-text-nyalur-error nv-mb-2">Gagal</h2>
        <p class="nv-text-sm nv-text-nyalur-muted nv-mb-6 nv-px-4">{errorMessage}</p>
        <div class="nv-flex nv-gap-3">
          <button on:click={() => dispatch('back')} class="nv-px-6 nv-py-3 nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-xl nv-hover-bg-nyalur-border nv-transition-colors nv-text-sm nv-active-scale-95">Kembali</button>
          <button on:click={retry} class="nv-px-6 nv-py-3 nv-bg-nyalur-green nv-text-nyalur-bg nv-font-bold nv-rounded-xl nv-hover-bg-nyalur-green-90 nv-transition-colors nv-text-sm nv-active-scale-95">Coba Lagi</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(#qr-shaded-region) { border-color: rgba(57, 255, 20, 0.3) !important; }
</style>
