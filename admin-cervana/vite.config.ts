import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ].filter(Boolean),

  server: {
    port: 3001,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.svelte-kit/**',
        '**/build/**',
        '**/dist/**'
      ]
    },
    hmr: {
      overlay: false
    }
  }
}));
