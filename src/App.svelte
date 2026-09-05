<script>
  import { onMount, onDestroy } from 'svelte';
  import Home from './views/Home.svelte';
  import Send from './views/Send.svelte';
  import Receive from './views/Receive.svelte';

  let currentView = 'home';
  let viewClass = 'nv-animate-fade-in';
  let deferredPrompt = null;
  let showInstallBanner = false;

  function navigate(view) {
    viewClass = view === 'home' ? 'nv-animate-slide-back' : 'nv-animate-slide-in';
    currentView = view;
    window.location.hash = view === 'home' ? '' : view;
  }

  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash === 'send' || hash === 'receive') {
      currentView = hash;
      viewClass = 'nv-animate-slide-in';
    } else {
      currentView = 'home';
      viewClass = 'nv-animate-fade-in';
    }
  }

  async function installPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') showInstallBanner = false;
      deferredPrompt = null;
    }
  }

  function dismissInstall() {
    showInstallBanner = false;
    localStorage.setItem('nyalur-install-dismissed', Date.now().toString());
  }

  onMount(() => {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const dismissed = localStorage.getItem('nyalur-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 86400000) {
        showInstallBanner = true;
      }
    });
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('hashchange', handleHashChange);
  });
</script>

<main class="nv-min-h-screen nv-bg-nyalur-bg">
  {#if showInstallBanner}
    <div class="install-banner nv-fixed nv-bottom-0 nv-left-0 nv-right-0 nv-z-50 nv-p-4 nv-flex nv-items-center nv-gap-3 nv-animate-fade-in safe-bottom">
      <div class="nv-w-10 nv-h-10 nv-rounded-xl nv-bg-nyalur-green-15 nv-flex nv-items-center nv-justify-center nv-flex-shrink-0">
        <svg class="nv-w-5 nv-h-5 nv-text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div class="nv-flex-1 nv-min-w-0">
        <p class="nv-text-sm nv-text-nyalur-text nv-font-medium">Install Nyalur</p>
        <p class="nv-text-xs nv-text-nyalur-muted">Akses lebih cepat dari home screen</p>
      </div>
      <button on:click={installPWA} class="nv-px-4 nv-py-2 nv-bg-nyalur-green nv-text-nyalur-bg nv-text-xs nv-font-bold nv-rounded-lg nv-active-scale-95 nv-flex-shrink-0">Install</button>
      <button on:click={dismissInstall} class="nv-text-nyalur-muted nv-p-1 nv-flex-shrink-0">
        <svg class="nv-w-4 nv-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  {/if}

  <div class={viewClass} key={currentView}>
    {#if currentView === 'home'}
      <Home on:navigate={(e) => navigate(e.detail)} />
    {:else if currentView === 'send'}
      <Send on:back={() => navigate('home')} />
    {:else if currentView === 'receive'}
      <Receive on:back={() => navigate('home')} />
    {/if}
  </div>
</main>

<style>
  .safe-bottom { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
</style>
