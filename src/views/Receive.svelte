<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { peerManager } from '../lib/peer-manager.js';
  import { receiveFiles, downloadFile } from '../lib/transfer-engine.js';
  import { addTransfer } from '../lib/history-db.js';
  import { formatFileSize, formatSpeed, formatTime } from '../lib/utils.js';
  import QRCode from 'qrcode';

  const dispatch = createEventDispatcher();

  let state = 'waiting'; // waiting, incoming, receiving, complete, error
  let errorMessage = '';
  let qrDataUrl = '';
  let copied = false;
  let offer = null;
  let receiver = null;
  let receivedFiles = [];
  let transferResult = null;

  let progress = {
    fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0,
    totalReceived: 0, totalSize: 0, speed: 0, elapsed: 0
  };

  let peerState;
  const unsubscribe = peerManager.subscribe(s => peerState = s);

  onMount(async () => {
    try {
      const peerId = await peerManager.init();
      await generateQR(peerId);
      peerManager.onIncomingConnection(handleIncomingConnection);
    } catch (e) {
      errorMessage = 'Gagal terhubung ke server: ' + (e.message || e);
      state = 'error';
    }
  });

  onDestroy(() => {
    unsubscribe();
    peerManager.destroy();
  });

  async function generateQR(text) {
    try {
      qrDataUrl = await QRCode.toDataURL(text, {
        width: 260,
        margin: 2,
        color: { dark: '#FF6B00', light: '#0F172A' },
        errorCorrectionLevel: 'M'
      });
    } catch (e) {
      console.error('QR generation failed:', e);
    }
  }

  function handleIncomingConnection(conn) {
    receiver = receiveFiles(
      conn,
      (offerData) => {
        offer = offerData;
        state = 'incoming';
      },
      (p) => { progress = p; },
      (fileInfo, blob) => {
        receivedFiles = [...receivedFiles, { ...fileInfo, blob }];
      },
      async (result) => {
        transferResult = result;
        state = 'complete';

        for (const file of receivedFiles) {
          downloadFile(file.blob, file.name);
        }

        await addTransfer({
          direction: 'received',
          peerName: offer?.deviceName || 'Unknown',
          files: result.files.map(f => ({ name: f.name || '', size: f.size || 0 })),
          totalSize: result.totalSize,
          duration: result.duration,
          status: 'completed'
        });
      }
    );
  }

  function acceptTransfer() {
    if (receiver) {
      receiver.accept();
      state = 'receiving';
    }
  }

  function rejectTransfer() {
    if (receiver) {
      receiver.reject();
      state = 'waiting';
      offer = null;
      receiver = null;
    }
  }

  async function copyPeerId() {
    if (peerState?.peerId) {
      try {
        await navigator.clipboard.writeText(peerState.peerId);
        copied = true;
        setTimeout(() => copied = false, 2000);
      } catch {
        const el = document.createElement('textarea');
        el.value = peerState.peerId;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        copied = true;
        setTimeout(() => copied = false, 2000);
      }
    }
  }

  function handleDownload(file) {
    downloadFile(file.blob, file.name);
  }

  function reset() {
    state = 'waiting';
    offer = null;
    receiver = null;
    receivedFiles = [];
    transferResult = null;
    errorMessage = '';
    progress = { fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0, totalReceived: 0, totalSize: 0, speed: 0, elapsed: 0 };
  }
</script>

<div class="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-6">
    <button on:click={() => dispatch('back')}
      class="w-10 h-10 rounded-xl bg-nyalur-surface flex items-center justify-center hover:bg-nyalur-border transition-colors active:scale-95">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <h1 class="text-xl font-bold text-nyalur-orange">TERIMA FILE</h1>
    {#if peerState?.status === 'connected'}
      <span class="ml-auto text-xs text-nyalur-orange/60 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-nyalur-orange"></span>
        Siap
      </span>
    {/if}
  </div>

  <div class="flex-1 flex flex-col items-center">

    {#if state === 'waiting'}
      {#if peerState?.status === 'connecting'}
        <div class="flex-1 flex flex-col items-center justify-center">
          <div class="w-[260px] h-[260px] bg-nyalur-surface rounded-2xl animate-pulse mb-4"></div>
          <p class="text-nyalur-muted text-sm">Menghubungkan ke server...</p>
        </div>

      {:else if peerState?.status === 'connected'}
        <div class="text-center">
          {#if qrDataUrl}
            <div class="bg-nyalur-surface rounded-2xl p-3 inline-block mb-4 border border-nyalur-border">
              <img src={qrDataUrl} alt="QR Code untuk koneksi" class="w-[236px] h-[236px] rounded-lg" />
            </div>
          {/if}

          <div class="mb-6">
            <p class="text-xs text-nyalur-muted uppercase tracking-widest mb-2">Kode Perangkat</p>
            <button
              on:click={copyPeerId}
              class="bg-nyalur-surface border border-nyalur-border rounded-xl px-4 py-3 font-mono text-sm
                     hover:border-nyalur-orange/50 transition-all inline-flex items-center gap-2 active:scale-95"
            >
              <span class="text-nyalur-orange tracking-wider">{peerState.peerId}</span>
              {#if copied}
                <svg class="w-4 h-4 text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              {:else}
                <svg class="w-4 h-4 text-nyalur-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              {/if}
            </button>
            {#if copied}
              <p class="text-xs text-nyalur-green mt-1 transition-opacity">Tersalin!</p>
            {/if}
          </div>

          <div class="flex items-center gap-2 justify-center mb-2">
            <span class="w-2 h-2 rounded-full bg-nyalur-orange animate-pulse"></span>
            <p class="text-sm text-nyalur-muted">Menunggu koneksi dari pengirim...</p>
          </div>
          <p class="text-xs text-nyalur-muted/40 mt-2 px-4">
            Berikan kode di atas ke pengirim, atau minta mereka scan QR code ini
          </p>
        </div>

      {:else if peerState?.status === 'error'}
        <div class="flex-1 flex flex-col items-center justify-center text-center">
          <p class="text-nyalur-error text-sm">{peerState.error}</p>
        </div>
      {/if}

    {:else if state === 'incoming'}
      <div class="w-full text-center">
        <div class="w-16 h-16 rounded-full bg-nyalur-orange/15 flex items-center justify-center mx-auto mb-4 animate-pulse-orange">
          <svg class="w-8 h-8 text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
        </div>

        <h2 class="text-lg font-bold mb-1">Transfer Masuk</h2>
        <p class="text-sm text-nyalur-muted mb-4">dari <span class="text-nyalur-orange">{offer?.deviceName || 'Pengirim'}</span></p>

        <div class="bg-nyalur-surface rounded-xl p-4 mb-6 text-left">
          {#if offer?.files}
            {#each offer.files as file}
              <div class="flex items-center gap-2 py-1.5">
                <svg class="w-4 h-4 text-nyalur-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span class="text-sm truncate flex-1">{file.name}</span>
                <span class="text-xs text-nyalur-muted flex-shrink-0">{formatFileSize(file.size)}</span>
              </div>
            {/each}
          {/if}
          <div class="border-t border-nyalur-border mt-2 pt-2 text-right">
            <span class="text-xs text-nyalur-muted font-medium">Total: {formatFileSize(offer?.totalSize || 0)}</span>
          </div>
        </div>

        <div class="flex gap-3 justify-center">
          <button on:click={rejectTransfer}
            class="flex-1 max-w-[140px] py-3 bg-nyalur-surface border border-nyalur-border rounded-xl
                   hover:bg-nyalur-border transition-colors text-sm active:scale-95">
            Tolak
          </button>
          <button on:click={acceptTransfer}
            class="flex-1 max-w-[140px] py-3 bg-nyalur-orange text-nyalur-bg font-bold rounded-xl
                   hover:bg-nyalur-orange/90 transition-colors text-sm active:scale-95">
            Terima
          </button>
        </div>
      </div>

    {:else if state === 'receiving'}
      <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <svg class="absolute w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="none" stroke="#334155" stroke-width="4" />
            <circle cx="48" cy="48" r="42" fill="none" stroke="#FF6B00" stroke-width="4"
              stroke-dasharray="263.9" stroke-dashoffset="{263.9 * (1 - progress.totalProgress)}"
              stroke-linecap="round" class="transition-all duration-500" />
          </svg>
          <span class="text-nyalur-orange font-bold text-xl">{Math.round(progress.totalProgress * 100)}%</span>
        </div>

        <p class="text-sm text-nyalur-text mb-1 truncate w-full px-8">{progress.fileName}</p>

        <div class="w-full bg-nyalur-surface rounded-full h-1.5 mb-3">
          <div class="bg-nyalur-orange h-1.5 rounded-full transition-all duration-500"
               style="width: {progress.totalProgress * 100}%"></div>
        </div>

        <div class="flex justify-between text-xs text-nyalur-muted w-full">
          <span>{formatFileSize(progress.totalReceived)} / {formatFileSize(progress.totalSize)}</span>
          <span>{formatSpeed(progress.speed)}</span>
        </div>

        {#if progress.speed > 0}
          <p class="text-xs text-nyalur-muted/60 mt-2">
            ~{formatTime((progress.totalSize - progress.totalReceived) / progress.speed)} lagi
          </p>
        {/if}
      </div>

    {:else if state === 'complete'}
      <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-full bg-nyalur-orange/15 flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-nyalur-orange mb-2">Diterima!</h2>
        {#if transferResult}
          <p class="text-sm text-nyalur-muted mb-4">
            {transferResult.files.length} file ({formatFileSize(transferResult.totalSize)}) dalam {formatTime(transferResult.duration / 1000)}
          </p>
        {/if}

        <div class="bg-nyalur-surface rounded-xl p-4 mb-6 text-left w-full">
          {#each receivedFiles as file}
            <div class="flex items-center gap-2 py-2">
              <svg class="w-4 h-4 text-nyalur-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm truncate flex-1">{file.name}</span>
              <button on:click={() => handleDownload(file)}
                class="text-xs text-nyalur-orange hover:underline flex-shrink-0 font-medium">
                Unduh
              </button>
            </div>
          {/each}
        </div>

        <button on:click={reset}
          class="px-8 py-3 bg-nyalur-surface border border-nyalur-border rounded-xl
                 hover:bg-nyalur-border transition-colors text-sm active:scale-95">
          Terima Lagi
        </button>
      </div>

    {:else if state === 'error'}
      <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-full bg-nyalur-error/15 flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-nyalur-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-nyalur-error mb-2">Error</h2>
        <p class="text-sm text-nyalur-muted mb-6 px-4">{errorMessage}</p>
        <button on:click={() => { reset(); dispatch('back'); }}
          class="px-8 py-3 bg-nyalur-surface border border-nyalur-border rounded-xl
                 hover:bg-nyalur-border transition-colors text-sm active:scale-95">
          Kembali
        </button>
      </div>
    {/if}
  </div>
</div>
