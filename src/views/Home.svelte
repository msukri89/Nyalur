<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getTransfers, clearTransfers } from '../lib/history-db.js';
  import { formatFileSize, formatDate } from '../lib/utils.js';

  const dispatch = createEventDispatcher();

  let history = [];
  let loading = true;
  let deviceName = '';
  let editingName = false;
  let nameInput = '';
  let showClearConfirm = false;

  onMount(async () => {
    deviceName = localStorage.getItem('nyalur-device-name') || '';
    try { history = await getTransfers(20); } catch (e) { console.error('Failed to load history:', e); }
    loading = false;
  });

  function startEditName() { nameInput = deviceName; editingName = true; }
  function saveName() { const t = nameInput.trim().substring(0, 20); if (t) { deviceName = t; localStorage.setItem('nyalur-device-name', t); } editingName = false; }
  function handleNameKey(e) { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') editingName = false; }
  async function handleClearHistory() { await clearTransfers(); history = []; showClearConfirm = false; }
</script>

<div class="flex flex-col items-center min-h-screen px-4 py-8">
  <div class="mt-6 mb-2 text-center animate-fade-in">
    <h1 class="text-5xl md:text-6xl font-black tracking-tight">
      <span class="text-nyalur-green">NYA</span><span class="text-nyalur-orange">LUR</span>
    </h1>
    <p class="text-nyalur-muted text-sm mt-2 tracking-wide">Salurkan file, langsung sampai.</p>
  </div>

  <div class="mt-3 mb-2">
    {#if editingName}
      <div class="flex items-center gap-2 animate-fade-in">
        <input type="text" bind:value={nameInput} on:keydown={handleNameKey} maxlength="20" class="bg-nyalur-surface border border-nyalur-border rounded-lg px-3 py-1.5 text-sm text-center text-nyalur-text focus:outline-none focus:border-nyalur-green/50 w-44 font-mono" autofocus />
        <button on:click={saveName} class="text-nyalur-green text-sm font-medium">OK</button>
      </div>
    {:else}
      <button on:click={startEditName} class="text-nyalur-muted/60 text-xs flex items-center gap-1.5 hover:text-nyalur-muted transition-colors">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        {deviceName || 'Perangkat'}
        <svg class="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
    {/if}
  </div>

  <div class="flex gap-4 md:gap-6 mt-8 mb-10 w-full max-w-sm justify-center">
    <button on:click={() => dispatch('navigate', 'send')} class="flex-1 max-w-[170px] aspect-square rounded-2xl bg-nyalur-surface border-2 border-nyalur-green/30 hover:border-nyalur-green hover:bg-nyalur-green/10 active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-3 group animate-pulse-green">
      <svg class="w-12 h-12 text-nyalur-green group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
      <span class="text-nyalur-green font-bold text-lg">KIRIM</span>
    </button>
    <button on:click={() => dispatch('navigate', 'receive')} class="flex-1 max-w-[170px] aspect-square rounded-2xl bg-nyalur-surface border-2 border-nyalur-orange/30 hover:border-nyalur-orange hover:bg-nyalur-orange/10 active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-3 group animate-pulse-orange">
      <svg class="w-12 h-12 text-nyalur-orange group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>
      <span class="text-nyalur-orange font-bold text-lg">TERIMA</span>
    </button>
  </div>

  <div class="w-full max-w-sm">
    {#if !loading && history.length > 0}
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-nyalur-muted text-xs uppercase tracking-widest flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Riwayat ({history.length})
        </h2>
        {#if showClearConfirm}
          <div class="flex items-center gap-2 animate-fade-in">
            <span class="text-xs text-nyalur-muted">Hapus semua?</span>
            <button on:click={handleClearHistory} class="text-xs text-nyalur-error font-medium">Ya</button>
            <button on:click={() => showClearConfirm = false} class="text-xs text-nyalur-muted">Batal</button>
          </div>
        {:else}
          <button on:click={() => showClearConfirm = true} class="text-xs text-nyalur-muted/40 hover:text-nyalur-muted transition-colors">Hapus</button>
        {/if}
      </div>
      <div class="space-y-2">
        {#each history as record}
          <div class="bg-nyalur-surface rounded-xl p-3 flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 {record.direction === 'sent' ? 'bg-nyalur-green/15' : 'bg-nyalur-orange/15'}">
              {#if record.direction === 'sent'}
                <svg class="w-4 h-4 text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
              {:else}
                <svg class="w-4 h-4 text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-nyalur-text truncate">{record.files ? record.files.map(f => f.name).join(', ') : 'File'}</p>
              <p class="text-xs text-nyalur-muted">{record.direction === 'sent' ? '→' : '←'} {record.peerName || '—'} · {formatFileSize(record.totalSize)} · {formatDate(record.timestamp)}</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0 {record.status === 'completed' ? 'bg-nyalur-green/15 text-nyalur-green' : 'bg-nyalur-error/15 text-nyalur-error'}">{record.status === 'completed' ? '✓' : '✗'}</span>
          </div>
        {/each}
      </div>
    {:else if !loading}
      <div class="text-center py-8 animate-fade-in">
        <div class="w-16 h-16 rounded-2xl bg-nyalur-surface flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-nyalur-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p class="text-nyalur-muted/40 text-sm">Belum ada transfer</p>
        <p class="text-nyalur-muted/25 text-xs mt-1">Mulai kirim atau terima file!</p>
      </div>
    {/if}
  </div>

  <div class="mt-auto pt-8 pb-4 text-center">
    <p class="text-nyalur-muted/30 text-xs">Nyalur v0.4.0 · P2P · Tanpa iklan · Tanpa kuota</p>
  </div>
</div>
