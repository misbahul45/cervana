<script setup lang="ts">
import SidebarLogin from '~/components/layout/SidebarLogin.vue';

</script>

<template>
<main class="sm:pt-20 pt-16 w-full bg-linear-to-br xl:px-12 lg:px-10 md:px-8 sm:px-6 px-4">
    <div class="z-50">
        <SidebarLogin />
    </div>
    <div class="w-full md:max-w-[95%] ml-auto">
        <slot />   
    </div>
</main>
</template>