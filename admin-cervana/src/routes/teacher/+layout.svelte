<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data, children } = $props();

  onMount(() => {
    if (!data?.user) {
      goto('/signin');
    }
  });
</script>

<div class="py-10">
  {@render children?.()}
</div>