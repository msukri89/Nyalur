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

<div class="nv-flex nv-flex-col nv-items-center nv-min-h-screen nv-px-4 nv-py-8">
  <div class="nv-mt-6 nv-mb-2 nv-text-center nv-animate-fade-in">
    <h1 class="nv-text-5xl nv-md-text-6xl nv-font-black nv-tracking-tight">
      <span class="nv-text-nyalur-green">NYA</span><span class="nv-text-nyalur-orange">LUR</span>
    </h1>
    <p class="nv-text-nyalur-muted nv-text-sm nv-mt-2 nv-tracking-wide">Salurkan file, langsung sampai.</p>
  </div>

  <div class="nv-mt-3 nv-mb-2">
    {#if editingName}
      <div class="nv-flex nv-items-center nv-gap-2 nv-animate-fade-in">
        <input type="text" bind:value={nameInput} on:keydown={handleNameKey} maxlength="20" class="nv-bg-nyalur-surface nv-border nv-border-nyalur-border nv-rounded-lg nv-px-3 nv-py-1-5 nv-text-sm nv-text-center nv-text-nyalur-text nv-focus-outline-none nv-focus-border-nyalur-green-50 nv-w-44 nv-font-mono" autofocus />
        <button on:click={saveName} class="nv-text-nyalur-green nv-text-sm nv-font-medium">OK</button>
      </div>
    {:else}
      <button on:click={startEditName} class="nv-text-nyalur-muted-60 nv-text-xs nv-flex nv-items-center nv-gap-1-5 nv-hover-text-nyalur-muted nv-transition-colors">
        <svg class="nv-w-3 nv-h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        {deviceName || 'Perangkat'}
        <svg class="nv-w-3 nv-h-3 nv-opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
    {/if}
  </div>

  <div class="nv-flex nv-gap-4 nv-md-gap-6 nv-mt-8 nv-mb-10 nv-w-full nv-max-w-sm nv-justify-center">
    <button on:click={() => dispatch('navigate', 'send')} class="nv-flex-1 nv-max-w--170px nv-aspect-square nv-rounded-2xl nv-bg-nyalur-surface nv-border-2 nv-border-nyalur-green-30 nv-hover-border-nyalur-green nv-hover-bg-nyalur-green-10 nv-active-scale-95 nv-transition-all nv-duration-300 nv-flex nv-flex-col nv-items-center nv-justify-center nv-gap-3 nv-group nv-animate-pulse-green">
      <svg class="nv-w-12 nv-h-12 nv-text-nyalur-green nv-group-hover-scale-110 nv-transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
      <span class="nv-text-nyalur-green nv-font-bold nv-text-lg">KIRIM</span>
    </button>
    <button on:click={() => dispatch('navigate', 'receive')} class="nv-flex-1 nv-max-w--170px nv-aspect-square nv-rounded-2xl nv-bg-nyalur-surface nv-border-2 nv-border-nyalur-orange-30 nv-hover-border-nyalur-orange nv-hover-bg-nyalur-orange-10 nv-active-scale-95 nv-transition-all nv-duration-300 nv-flex nv-flex-col nv-items-center nv-justify-center nv-gap-3 nv-group nv-animate-pulse-orange">
      <svg class="nv-w-12 nv-h-12 nv-text-nyalur-orange nv-group-hover-scale-110 nv-transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>
      <span class="nv-text-nyalur-orange nv-font-bold nv-text-lg">TERIMA</span>
    </button>
  </div>

  <div class="nv-w-full nv-max-w-sm">
    {#if !loading && history.length > 0}
      <div class="nv-flex nv-items-center nv-justify-between nv-mb-3">
        <h2 class="nv-text-nyalur-muted nv-text-xs nv-uppercase nv-tracking-widest nv-flex nv-items-center nv-gap-2">
          <svg class="nv-w-4 nv-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Riwayat ({history.length})
        </h2>
        {#if showClearConfirm}
          <div class="nv-flex nv-items-center nv-gap-2 nv-animate-fade-in">
            <span class="nv-text-xs nv-text-nyalur-muted">Hapus semua?</span>
            <button on:click={handleClearHistory} class="nv-text-xs nv-text-nyalur-error nv-font-medium">Ya</button>
            <button on:click={() => showClearConfirm = false} class="nv-text-xs nv-text-nyalur-muted">Batal</button>
          </div>
        {:else}
          <button on:click={() => showClearConfirm = true} class="nv-text-xs nv-text-nyalur-muted-40 nv-hover-text-nyalur-muted nv-transition-colors">Hapus</button>
        {/if}
      </div>
      <div class="nv-space-y-2">
        {#each history as record}
          <div class="nv-bg-nyalur-surface nv-rounded-xl nv-p-3 nv-flex nv-items-center nv-gap-3">
            <div class="nv-w-8 nv-h-8 nv-rounded-lg nv-flex nv-items-center nv-justify-center nv-flex-shrink-0 {record.direction === 'sent' ? 'nv-bg-nyalur-green-15' : 'nv-bg-nyalur-orange-15'}">
              {#if record.direction === 'sent'}
                <svg class="nv-w-4 nv-h-4 nv-text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
              {:else}
                <svg class="nv-w-4 nv-h-4 nv-text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>
              {/if}
            </div>
            <div class="nv-flex-1 nv-min-w-0">
              <p class="nv-text-sm nv-text-nyalur-text nv-truncate">{record.files ? record.files.map(f => f.name).join(', ') : 'File'}</p>
              <p class="nv-text-xs nv-text-nyalur-muted">{record.direction === 'sent' ? '→' : '←'} {record.peerName || '—'} · {formatFileSize(record.totalSize)} · {formatDate(record.timestamp)}</p>
            </div>
            <span class="nv-text-xs nv-px-2 nv-py-0-5 nv-rounded-full nv-flex-shrink-0 {record.status === 'completed' ? 'nv-bg-nyalur-green-15 nv-text-nyalur-green' : 'nv-bg-nyalur-error-15 nv-text-nyalur-error'}">{record.status === 'completed' ? '✓' : '✗'}</span>
          </div>
        {/each}
      </div>
    {:else if !loading}
      <div class="nv-text-center nv-py-8 nv-animate-fade-in">
        <div class="nv-w-16 nv-h-16 nv-rounded-2xl nv-bg-nyalur-surface nv-flex nv-items-center nv-justify-center nv-mx-auto nv-mb-4">
          <svg class="nv-w-8 nv-h-8 nv-text-nyalur-muted-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p class="nv-text-nyalur-muted-40 nv-text-sm">Belum ada transfer</p>
        <p class="nv-text-nyalur-muted-25 nv-text-xs nv-mt-1">Mulai kirim atau terima file!</p>
      </div>
    {/if}
  </div>

  <div class="nv-mt-auto nv-pt-8 nv-pb-4 nv-text-center">
    <p class="nv-text-nyalur-muted-30 nv-text-xs">Nyalur v0.4.0 · P2P · Tanpa iklan · Tanpa kuota</p>
  </div>
</div>
