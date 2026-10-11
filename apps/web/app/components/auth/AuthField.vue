<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  id: string;
  label: string;
  type?: string;
  autocomplete?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  inputmode?: 'text' | 'numeric' | 'email';
  maxlength?: number;
  disabled?: boolean;
}>();

const model = defineModel<string>({ default: '' });
const revealed = ref(false);

const isPassword = computed(() => props.type === 'password');
const inputType = computed(() => (isPassword.value && revealed.value ? 'text' : (props.type ?? 'text')));
const describedBy = computed(() => (props.error ? `${props.id}-error` : props.hint ? `${props.id}-hint` : undefined));
</script>

<template>
  <div class="rc-authfield">
    <label class="rc-label" :for="id">{{ label }}</label>
    <div class="rc-authfield__control">
      <input
        :id="id"
        v-model="model"
        class="rc-field"
        :class="{ 'rc-field--invalid': error, 'rc-field--with-toggle': isPassword }"
        :type="inputType"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
      />
      <button
        v-if="isPassword"
        type="button"
        class="rc-authfield__toggle"
        :aria-label="revealed ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <UIcon :name="revealed ? 'i-lucide-eye-off' : 'i-lucide-eye'" aria-hidden="true" />
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="rc-error-text" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="rc-hint">{{ hint }}</p>
  </div>
</template>
