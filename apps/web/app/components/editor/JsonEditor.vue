<script setup lang="ts">
const modelValue = defineModel<unknown>({ default: null });
defineProps<{ name: string; placeholder?: string; rows?: number; accept?: string }>();
const emit = defineEmits<{ update: [unknown] }>();
</script>

<template>
  <div class="json-editor w-full">
    <div class="flex items-center gap-2 mb-2 text-xs text-[var(--rc-fg-muted)]">
      <span class="font-mono px-2 py-0.5 bg-[var(--rc-bg-elevated,#f3f4f6)] rounded">{{ name }}</span>
      <span>JSON</span>
    </div>
    <textarea
      :value="JSON.stringify(modelValue, null, 2) || ''"
      @input="(e) => {
        try {
          emit('update', JSON.parse((e.target as HTMLTextAreaElement).value));
        } catch {
          /* ignore */
        }
      }"
      :rows="rows || 12"
      :placeholder="placeholder || '{\n  &quot;key&quot;: &quot;value&quot;\n}'"
      class="w-full font-mono text-sm p-3 rounded border border-[var(--rc-border)] bg-[var(--rc-bg)] text-[var(--rc-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--rc-primary)]"
    />
  </div>
</template>