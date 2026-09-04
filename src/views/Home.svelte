<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getTransfers } from '../lib/history-db.js';
  import { formatFileSize, formatDate } from '../lib/utils.js';

  const dispatch = createEventDispatcher();

  let history = [];
  let loading = true;

  onMount(async () => {
    try {
      history = await getTransfers(10);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    loading = false;
  });
</script>

<div class="flex flex-col items-center min-h-screen px-4 py-8">
  <!-- Logo -->
  <div class="mt-8 mb-2 text-center">
    <h1 class="text-5xl md:text-6xl font-black tracking-tight">
      <span class="text-nyalur-green">NYA</span><span class="text-nyalur-orange">LUR</span>
    </h1>
    <p class="text-nyalur-muted text-sm mt-2 tracking-wide">Salurkan file, langsung sampai.</p>
  </div>

  <!-- Main Buttons -->
  <div class="flex gap-4 md:gap-6 mt-12 mb-12 w-full max-w-sm justify-center">
    <!-- KIRIM -->
    <button
      on:click={() => dispatch('navigate', 'send')}
      class="flex-1 max-w-[170px] aspect-square rounded-2xl bg-nyalur-surface border-2 border-nyalur-green/30
             hover:border-nyalur-green hover:bg-nyalur-green/10 active:scale-95
             transition-all duration-300 flex flex-col items-center justify-center gap-3 group animate-pulse-green"
    >
      <svg class="w-12 h-12 text-nyalur-green group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
      <span class="text-nyalur-green font-bold text-lg">KIRIM</span>
    </button>

    <!-- TERIMA -->
    <button
      on:click={() => dispatch('navigate', 'receive')}
      class="flex-1 max-w-[170px] aspect-square rounded-2xl bg-nyalur-surface border-2 border-nyalur-orange/30
             hover:border-nyalur-orange hover:bg-nyalur-orange/10 active:scale-95
             transition-all duration-300 flex flex-col items-center justify-center gap-3 group animate-pulse-orange"
    >
      <svg class="w-12 h-12 text-nyalur-orange group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
      <span class="text-nyalur-orange font-bold text-lg">TERIMA</span>
    </button>
  </div>

  <!-- Transfer History -->
  {#if !loading && history.length > 0}
    <div class="w-full max-w-sm">
      <h2 class="text-nyalur-muted text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Riwayat Transfer
      </h2>
      <div class="space-y-2">
        {#each history as record}
          <div class="bg-nyalur-surface rounded-xl p-3 flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        {record.direction === 'sent' ? 'bg-nyalur-green/15' : 'bg-nyalur-orange/15'}">
              {#if record.direction === 'sent'}
                <svg class="w-4 h-4 text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              {:else}
                <svg class="w-4 h-4 text-nyalur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-nyalur-text truncate">
                {record.files ? record.files.map(f => f.name).join(', ') : 'File'}
              </p>
              <p class="text-xs text-nyalur-muted">
                {record.peerName || '—'} · {formatFileSize(record.totalSize)} · {formatDate(record.timestamp)}
              </p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0
                         {record.status === 'completed' ? 'bg-nyalur-green/15 text-nyalur-green' : 'bg-nyalur-error/15 text-nyalur-error'}">
              {record.status === 'completed' ? '✓' : '✗'}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Footer -->
  <div class="mt-auto pt-10 pb-4 text-center">
    <p class="text-nyalur-muted/40 text-xs">Nyalur v0.1.0 — Transfer file P2P tanpa iklan</p>
  </div>
</div>
