<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { coverInitial, coverTone } from '~/lib/topics';

const props = defineProps<{ src?: string | null; title: string }>();

const failed = ref(false);
const image = ref<HTMLImageElement | null>(null);

const showImage = computed(() => Boolean(props.src) && !failed.value);
const tone = computed(() => coverTone(props.title));
const initial = computed(() => coverInitial(props.title));

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

onMounted(() => {
  const element = image.value;
  if (element && element.complete && element.naturalWidth === 0) failed.value = true;
});
</script>

<template>
  <div class="rc-cover" :class="`rc-cover--t${tone}`">
    <img
      v-if="showImage"
      ref="image"
      :src="src ?? undefined"
      alt=""
      loading="lazy"
      decoding="async"
      class="rc-cover__img"
      @error="failed = true"
    />
    <span v-else class="rc-cover__initial" aria-hidden="true">{{ initial }}</span>
  </div>
</template>

<style>
.rc-cover {
  --cover-a: var(--rc-primary);
  --cover-b: var(--rc-secondary);
  position: relative;
  container-type: inline-size;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: var(--cover-ratio, 16 / 10);
  overflow: hidden;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--cover-a) 28%, var(--rc-surface)),
    color-mix(in srgb, var(--cover-b) 22%, var(--rc-surface))
  );
}
.rc-cover--t1 { --cover-a: var(--rc-secondary); --cover-b: var(--rc-info); }
.rc-cover--t2 { --cover-a: var(--rc-flame); --cover-b: var(--rc-gold); }
.rc-cover--t3 { --cover-a: var(--rc-info); --cover-b: var(--rc-primary); }
.rc-cover--t4 { --cover-a: var(--rc-gold); --cover-b: var(--rc-flame); }
.rc-cover--t5 { --cover-a: var(--rc-danger); --cover-b: var(--rc-flame); }
.rc-cover__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rc-cover__initial {
  color: color-mix(in srgb, var(--cover-a) 70%, var(--rc-fg));
  font-size: clamp(2.5rem, 12cqw, 4rem);
  font-weight: 900;
  line-height: 1;
}
</style>
