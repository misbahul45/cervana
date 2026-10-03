<script setup lang="ts">
const modelValue = defineModel<string>({ default: '' });
defineProps<{ placeholder?: string; rows?: number; minLength?: number; maxLength?: number }>();
const emit = defineEmits<{ save: []; cancel: [] }>();
</script>

<template>
  <div class="md-editor w-full">
    <div class="flex items-center gap-2 mb-2 border-b border-[var(--rc-border)] pb-2">
      <button type="button" class="md-btn" @click="(modelValue = (modelValue || '') + '**' + (modelValue || '') + '**')" title="Bold"><b>B</b></button>
      <button type="button" class="md-btn" @click="(modelValue = (modelValue || '') + '*' + (modelValue || '') + '*')" title="Italic"><i>I</i></button>
      <button type="button" class="md-btn" @click="(modelValue = (modelValue || '') + '\n# Judul\n')" title="Heading">H1</button>
      <button type="button" class="md-btn" @click="(modelValue = (modelValue || '') + '\n- item\n')" title="List">•</button>
      <button type="button" class="md-btn" @click="(modelValue = (modelValue || '') + '\n[link](https://)')" title="Link">🔗</button>
      <button type="button" class="md-btn" @click="(modelValue = (modelValue || '') + '\n```\nkode\n```')" title="Code">{ }</button>
      <span class="ml-auto text-xs text-[var(--rc-fg-muted)]">{{ (modelValue || '').length }} chars</span>
    </div>
    <textarea
      v-model="modelValue"
      :placeholder="placeholder"
      :rows="rows || 14"
      class="w-full font-mono text-sm p-3 rounded border border-[var(--rc-border)] bg-[var(--rc-bg)] text-[var(--rc-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--rc-primary)]"
    />
    <div class="flex gap-2 mt-3">
      <button type="button" class="md-action md-action-primary" @click="emit('save')">Save Draft</button>
      <button type="button" class="md-action md-action-secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.md-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  border-radius: 0.25rem;
  background: var(--rc-bg-elevated, #f3f4f6);
  color: var(--rc-fg, #111);
  cursor: pointer;
  transition: all 0.1s;
}
.md-btn:hover {
  background: var(--rc-primary, #3b82f6);
  color: white;
}
.md-action {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}
.md-action-primary {
  background: var(--rc-primary, #3b82f6);
  color: white;
}
.md-action-secondary {
  background: var(--rc-bg-elevated, #f3f4f6);
  color: var(--rc-fg, #111);
  border: 1px solid var(--rc-border, #d1d5db);
}
</style>