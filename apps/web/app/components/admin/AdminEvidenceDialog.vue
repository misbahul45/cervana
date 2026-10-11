<script setup lang="ts">
import { evidenceProblem } from '~/lib/admin';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    busy?: boolean;
    error?: string | null;
  }>(),
  { message: '', confirmLabel: 'Simpan', busy: false, error: null },
);

const emit = defineEmits<{ confirm: [payload: { file: File; note: string }]; cancel: [] }>();

const file = ref<File | null>(null);
const note = ref('');
const touched = ref(false);
const input = ref<HTMLInputElement | null>(null);
const titleId = useId();

const problem = computed(() => evidenceProblem(file.value));
const noteProblem = computed(() => (note.value.trim() !== '' && note.value.trim().length < 3 ? 'Catatan minimal 3 karakter.' : null));

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    file.value = null;
    note.value = '';
    touched.value = false;
    await nextTick();
    input.value?.focus();
  },
);

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function submit() {
  touched.value = true;
  if (problem.value || noteProblem.value || props.busy || !file.value) return;
  emit('confirm', { file: file.value, note: note.value.trim() });
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !props.busy) emit('cancel');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="rc-dialog__backdrop" @click.self="!busy && emit('cancel')" @keydown="onKeydown">
      <form class="rc-dialog__panel" role="dialog" aria-modal="true" :aria-labelledby="titleId" novalidate @submit.prevent="submit">
        <h2 :id="titleId">{{ title }}</h2>
        <p v-if="message">{{ message }}</p>
        <label class="rc-label">
          Bukti (gambar)
          <input ref="input" type="file" accept="image/*" class="rc-field" @change="onFile" />
        </label>
        <p v-if="touched && problem" class="rc-error-text" role="alert">{{ problem }}</p>
        <label class="rc-label">
          Catatan (opsional)
          <textarea v-model="note" rows="2" maxlength="500" class="rc-field" />
        </label>
        <p v-if="touched && noteProblem" class="rc-error-text" role="alert">{{ noteProblem }}</p>
        <p v-if="error" class="rc-alert rc-alert--error" role="alert">{{ error }}</p>
        <div class="rc-dialog__actions">
          <PlayButton variant="outline" :disabled="busy" @click="emit('cancel')">Batal</PlayButton>
          <PlayButton type="submit" :loading="busy">{{ confirmLabel }}</PlayButton>
        </div>
      </form>
    </div>
  </Teleport>
</template>
