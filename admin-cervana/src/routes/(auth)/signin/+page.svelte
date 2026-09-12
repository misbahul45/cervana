<script lang="ts">
  import FormAuth from "../../../features/auth/components/FormAuth.svelte";
  import type { PageProps } from './$types';

  let props: PageProps = $props();

  let showError = $state(false);

  $effect(() => {
    if (showError) {
      const timer = setTimeout(() => {
        showError = false;
      }, 5000);

      return () => clearTimeout(timer);
    }
  });

  $inspect(props);
</script>

<div class="h-full w-full flex px-4 flex-col justify-center items-center relative overflow-hidden">
  <div class="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/10"></div>
  
  <div class="absolute top-0 left-0 w-full h-full grid grid-cols-10 gap-4 p-4">
    {#each Array.from({ length: 100 }) as _, i}
      <div
        class="size-2 mx-auto rounded-full bg-primary dot"
        style="animation: bounce-dot 2s ease-in-out infinite, pulse-dot 3s ease-in-out infinite; animation-delay: {i * 0.05}s, {i * 0.1}s;"
      ></div>
    {/each}
  </div>

  <div class="absolute inset-0 opacity-30">
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-slow"></div>
    <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 2s;"></div>
  </div>

  <div class="w-full max-w-fit mx-auto p-4 rounded-md shadow-xl border-2 border-primary/80 bg-primary/20 backdrop-blur-2xl z-10 animate-slide-up">
    <div class="max-w-xl text-center mx-auto space-y-4 mb-2">
      <h1 class="md:text-2xl sm:text-xl text-lg font-semibold animate-fade-in">
        Sign In to Your <span class="font-bold text-primary animate-glow">CERVANA</span> Dashboard
      </h1>
      <p class="animate-fade-in md:text-base text-sm" style="animation-delay: 0.2s;">Inspire growth. Track progress. Unlock every learner&rsquo;s potential.</p>
    </div>
    <FormAuth form={props.form} />
    {#if !props.form?.success && showError}
      <p class="text-center text-red-500 text-sm">{props.form?.message}</p>
    {/if}
  </div>
</div>
