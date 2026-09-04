<script>
  import { onMount, onDestroy } from 'svelte';
  import Home from './views/Home.svelte';
  import Send from './views/Send.svelte';
  import Receive from './views/Receive.svelte';

  let currentView = 'home';

  function navigate(view) {
    currentView = view;
    window.location.hash = view === 'home' ? '' : view;
  }

  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash === 'send' || hash === 'receive') {
      currentView = hash;
    } else {
      currentView = 'home';
    }
  }

  onMount(() => {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', handleHashChange);
    }
  });
</script>

<main class="min-h-screen bg-nyalur-bg select-none">
  {#if currentView === 'home'}
    <Home on:navigate={(e) => navigate(e.detail)} />
  {:else if currentView === 'send'}
    <Send on:back={() => navigate('home')} />
  {:else if currentView === 'receive'}
    <Receive on:back={() => navigate('home')} />
  {/if}
</main>
