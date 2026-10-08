<script setup lang="ts">
interface Props {
  cost: number;
  question: string;
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();

function onConfirm() {
  if (props.disabled) return;
  emit('confirm');
}
</script>

<template>
  <ConfirmDialog
    :open="true"
    :title="`Konfirmasi biaya ${cost} kredit`"
    :message="`Pertanyaan ini memakai ${cost} kredit AI. Pastikan saldo Anda cukup.`"
    confirm-label="Kirim pertanyaan"
    cancel-label="Batal"
    @confirm="onConfirm"
    @cancel="emit('cancel')"
  />
</template>

<style scoped>
</style>