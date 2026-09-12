<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/ui/Sidebar.svelte';
  import { onMount } from 'svelte';
  import { userStore } from '$lib/stores/globals.store';
  import type { PageData } from './$types';

  let { children, data }: { data: PageData; children: any } = $props();

  $effect(() => {
    userStore.set(data?.user ?? null);
  });
</script>

<div class="flex h-screen">
  <Sidebar data={data} />

  <main class="w-full h-full md:px-10 sm:px-6 px-4 overflow-y-auto">
    {@render children()}
  </main>

  <footer></footer>
</div>
