<template>
  <section class="flex flex-row gap-4 p-2 bg-[#0e0c16]">
    <div class="flex-1 h-40 sm:h-72 md:h-96 rounded-xl bg-[#1b202b] animate-pulse"></div>

    <aside class="w-[25%] sm:w-[20%] md:w-56 flex flex-col gap-1 sm:gap-3">
      <div class="h-3 sm:h-6 w-1/2 rounded-md bg-white/10 animate-pulse"></div>

      <div class="flex flex-col gap-2 mt-2">
        <div
          v-for="i in 2"
          :key="i"
          class="flex-1 p-2 border border-orange-500/10 rounded-xl bg-white/5 shadow-md backdrop-blur-sm"
        >
          <div class="w-full h-9 sm:h-20 md:h-[120px] rounded-lg bg-white/10 animate-pulse"></div>
          <div class="h-2 sm:h-4 mt-1 md:mt-3 w-3/4 rounded bg-white/10 animate-pulse"></div>
        </div>
      </div>
    </aside>
  </section>
</template>
