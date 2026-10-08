<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  available?: Array<{ id: string; name: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  available: () => [],
});

const selected = ref(props.available[0]?.id || '');
const isOpen = ref(false);

function select(id: string) {
  selected.value = id;
  isOpen.value = false;
}
</script>

<template>
  <div v-if="available.length > 1" class="rc-tenant-switcher">
    <button
      type="button"
      class="rc-tenant-switcher__trigger"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="isOpen = !isOpen"
    >
      {{ available.find(t => t.id === selected)?.name || 'Pilih Tenant' }}
      <UIcon name="i-lucide-chevron-down" class="ml-1" aria-hidden="true" />
    </button>
    <ul v-if="isOpen" role="listbox" class="rc-tenant-switcher__list">
      <li
        v-for="t in available"
        :key="t.id"
        role="option"
        :aria-selected="selected === t.id"
        @click="select(t.id)"
      >
        {{ t.name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.rc-tenant-switcher { position: relative; }
.rc-tenant-switcher__trigger {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  cursor: pointer;
}
.rc-tenant-switcher__trigger:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.rc-tenant-switcher__list {
  position: absolute;
  top: calc(100% + 0.25rem);
  right: 0;
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  background: var(--ui-bg, white);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 0.5rem;
  min-width: 12rem;
  z-index: 50;
}
.rc-tenant-switcher__list li {
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
}
.rc-tenant-switcher__list li[aria-selected="true"] {
  background: var(--ui-bg-muted, #f3f4f6);
}
</style>