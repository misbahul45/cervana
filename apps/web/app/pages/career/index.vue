<script setup lang="ts">
import { ref } from 'vue';
import { agentApi } from '~/lib/api';

const query = ref('');
const result = ref<any>(null);
const submitting = ref(false);
const error = ref('');

async function ask() {
  submitting.value = true;
  error.value = '';
  try {
    result.value = await agentApi.run({ userId: 'me', intent: 'career', query: query.value });
  } catch (e: any) {
    error.value = e?.data?.message ?? 'agent_failed';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Konsultan Karier — ReduCera' });
</script>

<template>
  <main>
    <h1>Konsultan Karier</h1>
    <p>Berdasarkan penguasaan dan nilai kontribusimu, berikut rekomendasi kariermu.</p>
    <textarea v-model="query" rows="3" placeholder="Tanya tentang langkah kariermu..."></textarea>
    <button :disabled="submitting || !query" @click="ask">{{ submitting ? 'Memikirkan…' : 'Tanya' }}</button>
    <pre v-if="result">{{ JSON.stringify(result.deterministicOutputs, null, 2) }}</pre>
    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>