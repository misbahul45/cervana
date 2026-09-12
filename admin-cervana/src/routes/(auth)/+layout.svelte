<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data, children }=$props()

  onMount(() => {
    if (data?.user) {
      const role = data.user.role;

      if (role === 'TEACHER') {
        goto('/teacher');
      }
    }
  });
</script>


{@render children()}

