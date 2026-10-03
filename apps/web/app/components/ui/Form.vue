<script setup lang="ts">
defineProps<{ fields: Array<{ name: string; label: string; type?: 'text' | 'email' | 'number' | 'date' | 'select'; required?: boolean; options?: Array<{ value: string; label: string }> }>; submitLabel?: string }>();
const emit = defineEmits<{ submit: [Record<string, unknown>] }>();
const data = reactive<Record<string, unknown>>({});

function onSubmit(e: Event) {
  e.preventDefault();
  emit('submit', { ...data });
}
</script>

<template>
  <form @submit="onSubmit" class="space-y-4">
    <div v-for="field in fields" :key="field.name" class="form-field">
      <label :for="field.name" class="form-label">
        {{ field.label }}
        <span v-if="field.required" class="required">*</span>
      </label>
      <select
        v-if="field.type === 'select' && field.options"
        :id="field.name"
        v-model="data[field.name]"
        class="form-input"
        :required="field.required"
      >
        <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <input
        v-else
        :id="field.name"
        v-model="data[field.name]"
        :type="field.type || 'text'"
        class="form-input"
        :required="field.required"
      />
    </div>
    <button v-if="submitLabel" type="submit" class="submit-btn">{{ submitLabel }}</button>
  </form>
</template>

<style scoped>
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-label { font-size: 0.875rem; font-weight: 500; color: var(--rc-fg, #111); }
.required { color: var(--rc-danger, #dc2626); margin-left: 0.125rem; }
.form-input { padding: 0.5rem 0.75rem; border-radius: 0.375rem; border: 1px solid var(--rc-border, #d1d5db); background: var(--rc-bg, #fff); color: var(--rc-fg, #111); }
.form-input:focus { outline: none; border-color: var(--rc-primary, #3b82f6); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.submit-btn { width: 100%; padding: 0.625rem 1rem; background: var(--rc-primary, #3b82f6); color: white; font-weight: 600; border-radius: 0.5rem; border: none; cursor: pointer; }
</style>