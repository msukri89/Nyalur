import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: '/Nyalur/',
  publicDir: 'static',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
