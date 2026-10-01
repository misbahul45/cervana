<script setup lang="ts">
import MarkdownIt from 'markdown-it';

const props=defineProps<{
    text:string
}>()

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
const renderedMarkdown = computed(() => md.render(props.text))
</script>

<template>
      <div class="prose dark:prose-invert prose-sm text-justify max-w-full" v-html="renderedMarkdown"></div>
</template>