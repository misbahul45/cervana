<script lang="ts">
  import type { PageProps } from "../$types";

  let { data }:PageProps =$props()

  const user=data.user
 $inspect(user)
</script>

<div>
  {#if user?.id}
    <h1>Hello {user.name} 👋</h1>
  {:else}
    <h1>Hello, Guest 👋</h1>
  {/if}
</div>
