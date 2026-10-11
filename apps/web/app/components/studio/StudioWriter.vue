<script setup lang="ts">
import PlayButton from '~/components/play/PlayButton.vue';
import { insertBlock, prefixLines, wrapSelection, type EditResult } from '~/lib/editor';
import { renderMarkdown } from '~/lib/markdown';

const props = withDefaults(defineProps<{ disabled?: boolean; withSubtitle?: boolean }>(), { disabled: false, withSubtitle: true });

const title = defineModel<string>('title', { default: '' });
const subtitle = defineModel<string>('subtitle', { default: '' });
const body = defineModel<string>('body', { default: '' });

const mode = ref<'write' | 'preview'>('write');
const area = ref<HTMLTextAreaElement | null>(null);
const html = computed(() => (mode.value === 'preview' ? renderMarkdown(body.value) : ''));
const words = computed(() => body.value.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length);

const TOOLS = [
  { id: 'h2', label: 'Judul bagian', icon: 'i-lucide-heading-2' },
  { id: 'h3', label: 'Sub judul', icon: 'i-lucide-heading-3' },
  { id: 'bold', label: 'Tebal', icon: 'i-lucide-bold' },
  { id: 'italic', label: 'Miring', icon: 'i-lucide-italic' },
  { id: 'quote', label: 'Kutipan', icon: 'i-lucide-quote' },
  { id: 'bullets', label: 'Daftar poin', icon: 'i-lucide-list' },
  { id: 'numbers', label: 'Daftar nomor', icon: 'i-lucide-list-ordered' },
  { id: 'code', label: 'Blok kode', icon: 'i-lucide-code' },
  { id: 'link', label: 'Tautan', icon: 'i-lucide-link' },
  { id: 'rule', label: 'Pemisah', icon: 'i-lucide-minus' },
] as const;

type ToolId = (typeof TOOLS)[number]['id'];

const EDITS: Record<ToolId, (text: string, start: number, end: number) => EditResult> = {
  h2: (text, start, end) => prefixLines(text, start, end, '## '),
  h3: (text, start, end) => prefixLines(text, start, end, '### '),
  bold: (text, start, end) => wrapSelection(text, start, end, '**', '**', 'teks tebal'),
  italic: (text, start, end) => wrapSelection(text, start, end, '*', '*', 'teks miring'),
  quote: (text, start, end) => prefixLines(text, start, end, '> '),
  bullets: (text, start, end) => prefixLines(text, start, end, '- '),
  numbers: (text, start, end) => prefixLines(text, start, end, (index) => `${index + 1}. `),
  code: (text, start) => insertBlock(text, start, '```\nkode\n```'),
  link: (text, start, end) => wrapSelection(text, start, end, '[', '](https://)', 'teks tautan'),
  rule: (text, start) => insertBlock(text, start, '---'),
};

function apply(tool: ToolId) {
  const element = area.value;
  if (!element || props.disabled) return;
  const result = EDITS[tool](body.value, element.selectionStart, element.selectionEnd);
  body.value = result.text;
  nextTick(() => {
    element.focus();
    element.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
}

function showWrite() {
  mode.value = 'write';
  nextTick(() => area.value?.focus());
}
</script>

<template>
  <div class="rc-writer">
    <textarea
      v-model="title"
      rows="1"
      class="rc-writer__title"
      maxlength="160"
      placeholder="Judul"
      aria-label="Judul"
      :disabled="disabled"
      @keydown.enter.prevent
    />
    <textarea
      v-if="withSubtitle"
      v-model="subtitle"
      class="rc-writer__subtitle"
      rows="2"
      maxlength="500"
      placeholder="Ringkasan singkat yang tampil di kartu dan di bawah judul"
      aria-label="Ringkasan"
      :disabled="disabled"
    />

    <div class="rc-writer__bar" role="toolbar" aria-label="Format teks">
      <button
        v-for="tool in TOOLS"
        :key="tool.id"
        type="button"
        class="rc-writer__tool"
        :aria-label="tool.label"
        :title="tool.label"
        :disabled="disabled || mode === 'preview'"
        @click="apply(tool.id)"
      >
        <UIcon :name="tool.icon" aria-hidden="true" />
      </button>
      <span class="rc-writer__count" aria-live="polite">{{ words }} kata</span>
      <div class="rc-writer__tabs" role="group" aria-label="Mode editor">
        <PlayButton size="sm" :variant="mode === 'write' ? 'primary' : 'ghost'" :aria-pressed="mode === 'write'" @click="showWrite">Tulis</PlayButton>
        <PlayButton size="sm" :variant="mode === 'preview' ? 'primary' : 'ghost'" :aria-pressed="mode === 'preview'" @click="mode = 'preview'">Pratinjau</PlayButton>
      </div>
    </div>

    <textarea
      v-show="mode === 'write'"
      ref="area"
      v-model="body"
      class="rc-writer__body"
      placeholder="Tulis ceritamu di sini. Format dengan Markdown atau pakai tombol di atas."
      aria-label="Isi artikel"
      :disabled="disabled"
    />
    <div v-if="mode === 'preview'" class="rc-story rc-writer__preview" aria-label="Pratinjau artikel">
      <h1 class="rc-story__title">{{ title || 'Tanpa judul' }}</h1>
      <p v-if="subtitle" class="rc-story__subtitle">{{ subtitle }}</p>
      <div v-if="html" class="rc-story__body" v-html="html" />
      <p v-else class="rc-hint">Belum ada isi untuk dipratinjau.</p>
    </div>
  </div>
</template>
