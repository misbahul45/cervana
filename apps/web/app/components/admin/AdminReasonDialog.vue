<script setup lang="ts">
import { REASON_MAX, reasonProblem } from '~/lib/admin';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    label?: string;
    destructive?: boolean;
    busy?: boolean;
    error?: string | null;
    required?: boolean;
  }>(),
  { message: '', confirmLabel: 'Lanjutkan', label: 'Alasan', destructive: false, busy: false, error: null, required: true },
);

const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>();

const reason = ref('');
const touched = ref(false);
const field = ref<HTMLTextAreaElement | null>(null);
const titleId = useId();

const problem = computed(() => {
  if (!props.required && reason.value.trim() === '') return null;
  return reasonProblem(reason.value);
});

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    reason.value = '';
    touched.value = false;
    await nextTick();
    field.value?.focus();
  },
);

function submit() {
  touched.value = true;
  if (problem.value || props.busy) return;
  emit('confirm', reason.value.trim());
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
          {{ label }}
          <textarea
            ref="field"
            v-model="reason"
            rows="3"
            :maxlength="REASON_MAX"
            class="rc-field"
            :class="{ 'rc-field--invalid': touched && problem }"
            :aria-invalid="touched && problem ? 'true' : undefined"
          />
        </label>
        <p v-if="touched && problem" class="rc-error-text" role="alert">{{ problem }}</p>
        <p v-if="error" class="rc-alert rc-alert--error" role="alert">{{ error }}</p>
        <div class="rc-dialog__actions">
          <PlayButton variant="outline" :disabled="busy" @click="emit('cancel')">Batal</PlayButton>
          <PlayButton type="submit" :variant="destructive ? 'danger' : 'primary'" :loading="busy">{{ confirmLabel }}</PlayButton>
        </div>
      </form>
    </div>
  </Teleport>
</template>
