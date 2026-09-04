<script>
  import { onMount, onDestroy } from 'svelte';
  import Home from './views/Home.svelte';
  import Send from './views/Send.svelte';
  import Receive from './views/Receive.svelte';

  let currentView = 'home';
  let viewClass = 'animate-fade-in';
  let deferredPrompt = null;
  let showInstallBanner = false;

  function navigate(view) {
    viewClass = view === 'home' ? 'animate-slide-back' : 'animate-slide-in';
    currentView = view;
    window.location.hash = view === 'home' ? '' : view;
  }

  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash === 'send' || hash === 'receive') {
      currentView = hash;
      viewClass = 'animate-slide-in';
    } else {
      currentView = 'home';
      viewClass = 'animate-fade-in';
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

<main class="min-h-screen bg-nyalur-bg">
  {#if showInstallBanner}
    <div class="install-banner fixed bottom-0 left-0 right-0 z-50 p-4 flex items-center gap-3 animate-fade-in safe-bottom">
      <div class="w-10 h-10 rounded-xl bg-nyalur-green/15 flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 text-nyalur-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-nyalur-text font-medium">Install Nyalur</p>
        <p class="text-xs text-nyalur-muted">Akses lebih cepat dari home screen</p>
      </div>
      <button on:click={installPWA} class="px-4 py-2 bg-nyalur-green text-nyalur-bg text-xs font-bold rounded-lg active:scale-95 flex-shrink-0">Install</button>
      <button on:click={dismissInstall} class="text-nyalur-muted p-1 flex-shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
