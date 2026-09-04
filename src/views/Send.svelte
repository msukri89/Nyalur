<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { peerManager } from '../lib/peer-manager.js';
  import { sendFiles } from '../lib/transfer-engine.js';
  import { addTransfer } from '../lib/history-db.js';
  import { formatFileSize, formatSpeed, formatTime } from '../lib/utils.js';

  const dispatch = createEventDispatcher();

  let state = 'idle'; // idle, connecting, transferring, complete, error
  let selectedFiles = [];
  let remotePeerId = '';
  let errorMessage = '';
  let result = null;

  let progress = {
    fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0,
    totalSent: 0, totalSize: 0, speed: 0, elapsed: 0
  };

  let peerState;
  const unsubscribe = peerManager.subscribe(s => peerState = s);

  onMount(async () => {
    try {
      await peerManager.init();
    } catch (e) {
      errorMessage = 'Gagal terhubung ke server: ' + (e.message || e);
      state = 'error';
    }
  });

  onDestroy(() => {
    unsubscribe();
    peerManager.destroy();
  });

  function handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      selectedFiles = [...selectedFiles, ...Array.from(files)];
    }
    event.target.value = '';
  }

  function removeFile(index) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
  }

  async function connect() {
    const peerId = remotePeerId.trim();
    if (!peerId || selectedFiles.length === 0) return;

    state = 'connecting';
    errorMessage = '';

    try {
      const conn = await peerManager.connectTo(peerId);
      state = 'transferring';

      const transferResult = await sendFiles(conn, selectedFiles, (p) => {
        progress = p;
      });

      result = transferResult;
      state = 'complete';

      await addTransfer({
        direction: 'sent',
        peerName: peerId.substring(0, 16),
        files: transferResult.files,
        totalSize: transferResult.totalSize,
        duration: transferResult.duration,
        status: 'completed'
      });
    } catch (e) {
      errorMessage = e.message || 'Transfer gagal';
      state = 'error';

      await addTransfer({
        direction: 'sent',
        peerName: peerId.substring(0, 16),
        files: selectedFiles.map(f => ({ name: f.name, size: f.size })),
        totalSize: selectedFiles.reduce((s, f) => s + f.size, 0),
        duration: progress.elapsed,
        status: 'failed'
      });
    }
  }

  function reset() {
    state = 'idle';
    selectedFiles = [];
    remotePeerId = '';
    errorMessage = '';
    result = null;
    progress = { fileIndex: 0, fileName: '', fileProgress: 0, totalProgress: 0, totalSent: 0, totalSize: 0, speed: 0, elapsed: 0 };
  }

  $: totalSelectedSize = selectedFiles.reduce((s, f) => s + f.size, 0);
  $: canSend = selectedFiles.length > 0 && remotePeerId.trim().length > 0 && state !== 'connecting';
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
    <h1 class="text-xl font-bold text-nyalur-green">KIRIM FILE</h1>
    {#if peerState?.status === 'connected'}
      <span class="ml-auto text-xs text-nyalur-green/60 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-nyalur-green"></span>
        Online
      </span>
    {/if}
  </div>

  <div class="flex-1 flex flex-col">
    {#if state === 'idle' || state === 'connecting'}
      <!-- File Picker -->
      <label class="block w-full mb-4 cursor-pointer">
        <div class="border-2 border-dashed border-nyalur-border rounded-xl p-6 text-center
                    hover:border-nyalur-green/50 hover:bg-nyalur-green/5 transition-all active:scale-[0.98]">
          <svg class="w-10 h-10 text-nyalur-muted mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <p class="text-nyalur-muted text-sm font-medium">Tap untuk pilih file</p>
          <p class="text-nyalur-muted/40 text-xs mt-1">Foto, video, dokumen — semua jenis file</p>
        </div>
        <input type="file" multiple class="hidden" on:change={handleFileSelect} />
      </label>

      <!-- Selected Files -->
      {#if selectedFiles.length > 0}
        <div class="space-y-2 mb-6">
          {#each selectedFiles as file, i}
            <div class="bg-nyalur-surface rounded-xl px-3 py-2.5 flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-nyalur-green/15 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm truncate">{file.name}</p>
                <p class="text-xs text-nyalur-muted">{formatFileSize(file.size)}</p>
              </div>
              <button on:click={() => removeFile(i)} class="text-nyalur-muted hover:text-nyalur-error transition-colors p-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
          <p class="text-xs text-nyalur-muted text-right">{selectedFiles.length} file · Total: {formatFileSize(totalSelectedSize)}</p>
        </div>

        <!-- Peer ID Input -->
        <div class="mb-4">
          <label class="text-xs text-nyalur-muted uppercase tracking-widest mb-2 block">Kode Penerima</label>
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={remotePeerId}
              placeholder="Masukkan kode dari penerima..."
              class="flex-1 bg-nyalur-surface border border-nyalur-border rounded-xl px-4 py-3
                     text-nyalur-text placeholder-nyalur-muted/40 focus:outline-none focus:border-nyalur-green/50
                     text-sm font-mono tracking-wide disabled:opacity-50"
              disabled={state === 'connecting'}
            />
            <button
              on:click={connect}
              disabled={!canSend}
              class="px-5 py-3 bg-nyalur-green text-nyalur-bg font-bold rounded-xl
                     hover:bg-nyalur-green/90 active:scale-95
                     disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm whitespace-nowrap"
            >
              {#if state === 'connecting'}
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" class="opacity-75" />
                </svg>
              {:else}
                Kirim
              {/if}
            </button>
          </div>
          <p class="text-xs text-nyalur-muted/40 mt-2">Minta penerima buka Nyalur → tap TERIMA → salin kode</p>
        </div>
      {/if}

    {:else if state === 'transferring'}
      <!-- Progress -->
      <div class="flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <svg class="absolute w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="none" stroke="#334155" stroke-width="4" />
            <circle cx="48" cy="48" r="42" fill="none" stroke="#39FF14" stroke-width="4"
              stroke-dasharray="263.9" stroke-dashoffset="{263.9 * (1 - progress.totalProgress)}"
              stroke-linecap="round" class="transition-all duration-500" />
          </svg>
          <span class="text-nyalur-green font-bold text-xl">{Math.round(progress.totalProgress * 100)}%</span>
        </div>

        <p class="text-sm text-nyalur-text mb-1 truncate w-full px-8">{progress.fileName}</p>
        <p class="text-xs text-nyalur-muted mb-4">
          File {progress.fileIndex + 1} dari {selectedFiles.length}
        </p>

        <div class="w-full bg-nyalur-surface rounded-full h-1.5 mb-3">
          <div class="bg-nyalur-green h-1.5 rounded-full transition-all duration-500"
               style="width: {progress.totalProgress * 100}%"></div>
        </div>

        <div class="flex justify-between text-xs text-nyalur-muted w-full">
          <span>{formatFileSize(progress.totalSent)} / {formatFileSize(progress.totalSize)}</span>
          <span>{formatSpeed(progress.speed)}</span>
        </div>

        {#if progress.speed > 0}
          <p class="text-xs text-nyalur-muted/60 mt-2">
            ~{formatTime((progress.totalSize - progress.totalSent) / progress.speed)} lagi
          </p>
        {/if}
      </div>

    {:else if state === 'complete'}
      <!-- Success -->
      <div class="flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-full bg-nyalur-green/15 flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-nyalur-green mb-2">Berhasil!</h2>
        {#if result}
          <p class="text-sm text-nyalur-muted">
            {result.files.length} file ({formatFileSize(result.totalSize)}) terkirim dalam {formatTime(result.duration / 1000)}
          </p>
        {/if}
        <button on:click={reset}
          class="mt-8 px-8 py-3 bg-nyalur-surface border border-nyalur-border rounded-xl
                 hover:bg-nyalur-border transition-colors text-sm active:scale-95">
          Kirim Lagi
        </button>
      </div>

    {:else if state === 'error'}
      <!-- Error -->
      <div class="flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-full bg-nyalur-error/15 flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-nyalur-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-nyalur-error mb-2">Gagal</h2>
        <p class="text-sm text-nyalur-muted mb-6 px-4">{errorMessage}</p>
        <button on:click={reset}
          class="px-8 py-3 bg-nyalur-surface border border-nyalur-border rounded-xl
                 hover:bg-nyalur-border transition-colors text-sm active:scale-95">
          Coba Lagi
        </button>
      </div>
    {/if}
  </div>
</div>
