<script lang="ts">
  import { enhance } from '$app/forms';
  import {Eye, EyeOff} from '@lucide/svelte';
  import type { ActionData } from '../../../routes/(auth)/signin/$types';
  import { goto, invalidateAll } from '$app/navigation';
  import { authService } from '$lib/services/auth';
  

  let { form }:{ form:ActionData }=$props()
  let showPassword = $state(false);
  
  const formInputs = [
    {
      name: 'email',
      placeholder: 'Input your email',
      type: 'email'
    },
    {
      name: 'password',
      placeholder: 'Input your password',
      type: 'password'
    }
  ];

  const togglePassword = () => showPassword = !showPassword;
  

$effect(() => {
	(async () => {
		if (form?.success) {
      await invalidateAll()
			const role = form.data?.role;
			if (role === 'TEACHER') {
				goto('/teacher');
			} else if (role === 'ADMIN') {
				goto('/admin');
			} else {
				await authService.logout();
			}
		}
	})();
});

</script>

<form use:enhance method="POST" action="?/login" class="w-full max-w-lg sm:p-2  space-y-4">
  {#each formInputs as input}
    <div class="space-y-1">
      <div class="w-full relative">
        <input
          name={input.name}
          placeholder={input.placeholder}
          type={input.type === 'password' && showPassword ? 'text' : input.type}
          class="w-full px-4 py-2 text-black bg-white border-none outline-none ring ring-primary/20 placeholder:tet-bas placeholder:text-gray-800 focus:ring-2 transition-all duration-200 rounded"
        />
        {#if input.type === 'password'}
          <button
            type="button"
            onclick={togglePassword}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary transition-colors"
          >
            {#if showPassword}
              <EyeOff />
            {:else}
              <Eye />
            {/if}
          </button>
        {/if}
      </div>
    </div>
  {/each}

  <button
    type="submit"
    class="w-full py-2 bg-primary/40 shadow-lg shadow-accent/10 font-semibold hover:bg-primary/80 rounded transition-all duration-200 active:scale-95 cursor-pointer"
  >
    Sign in to my account
  </button>
</form>
