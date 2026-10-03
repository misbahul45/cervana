<script setup lang="ts">
import { ref, computed } from 'vue';
import { simulatorApi } from '~/lib/api';

const props = defineProps<{ title: string; data: Record<string, number | string | boolean> }>();
</script>

<template>
  <section class="statement-panel">
    <h2>{{ title }}</h2>
    <dl>
      <template v-for="(value, key) in data" :key="key">
        <dt>{{ key }}</dt>
        <dd>{{ value }}</dd>
      </template>
    </dl>
  </section>
</template>