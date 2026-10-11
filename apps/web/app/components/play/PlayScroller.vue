<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useHydrated } from '~/composables/useHydrated';
import { edges, pageStep, scrollLeftForThumb, thumbMetrics } from '~/lib/scroller';

const props = withDefaults(defineProps<{ label: string; arrows?: boolean; minThumb?: number }>(), { arrows: true, minThumb: 48 });

const viewport = ref<HTMLElement | null>(null);
const track = ref<HTMLElement | null>(null);
const hydrated = useHydrated();
const dragging = ref(false);
const state = reactive({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0, trackWidth: 0 });

const metrics = computed(() => thumbMetrics(state, state.trackWidth, props.minThumb));
const edge = computed(() => edges(state));
const thumbStyle = computed(() => ({ width: `${metrics.value.width}px`, transform: `translateX(${metrics.value.left}px)` }));

function measure() {
  const element = viewport.value;
  if (!element) return;
  state.scrollLeft = element.scrollLeft;
  state.clientWidth = element.clientWidth;
  state.scrollWidth = element.scrollWidth;
  state.trackWidth = track.value?.clientWidth ?? 0;
}

let frame = 0;
function onScroll() {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    measure();
  });
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function page(direction: 1 | -1) {
  const element = viewport.value;
  if (!element) return;
  element.scrollBy({ left: direction * pageStep(element.clientWidth), behavior: reduced() ? 'auto' : 'smooth' });
}

function moveThumbTo(thumbLeft: number) {
  const element = viewport.value;
  if (!element) return;
  element.scrollLeft = scrollLeftForThumb(thumbLeft, state, state.trackWidth, metrics.value.width);
}

function startDrag(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement;
  const startX = event.clientX;
  const startLeft = metrics.value.left;
  dragging.value = true;
  target.setPointerCapture(event.pointerId);

  const move = (moveEvent: PointerEvent) => moveThumbTo(startLeft + moveEvent.clientX - startX);
  const stop = () => {
    dragging.value = false;
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', stop);
    target.removeEventListener('pointercancel', stop);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', stop);
  target.addEventListener('pointercancel', stop);
}

function jump(event: PointerEvent) {
  const bounds = track.value?.getBoundingClientRect();
  if (!bounds) return;
  moveThumbTo(event.clientX - bounds.left - metrics.value.width / 2);
}

let observer: ResizeObserver | null = null;

onMounted(() => {
  measure();
  observer = new ResizeObserver(measure);
  if (viewport.value) {
    observer.observe(viewport.value);
    if (viewport.value.firstElementChild) observer.observe(viewport.value.firstElementChild);
  }
  if (track.value) observer.observe(track.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  if (frame) window.cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="rc-scroller" :class="{ 'rc-scroller--more-start': hydrated && metrics.visible && !edge.atStart, 'rc-scroller--more-end': hydrated && metrics.visible && !edge.atEnd }">
    <div class="rc-scroller__stage">
      <button
        v-if="arrows && hydrated && metrics.visible"
        type="button"
        class="rc-scroller__arrow rc-scroller__arrow--prev"
        :disabled="edge.atStart"
        aria-label="Geser ke kiri"
        @click="page(-1)"
      >
        <UIcon name="i-lucide-chevron-left" aria-hidden="true" />
      </button>
      <div ref="viewport" class="rc-scroller__viewport" role="region" :aria-label="label" tabindex="0" @scroll.passive="onScroll">
        <slot />
      </div>
      <button
        v-if="arrows && hydrated && metrics.visible"
        type="button"
        class="rc-scroller__arrow rc-scroller__arrow--next"
        :disabled="edge.atEnd"
        aria-label="Geser ke kanan"
        @click="page(1)"
      >
        <UIcon name="i-lucide-chevron-right" aria-hidden="true" />
      </button>
    </div>
    <div ref="track" class="rc-scroller__bar" :class="{ 'is-hidden': !metrics.visible }" aria-hidden="true" @pointerdown="jump">
      <span class="rc-scroller__thumb" :class="{ 'is-dragging': dragging }" :style="thumbStyle" @pointerdown.stop="startDrag" />
    </div>
  </div>
</template>
