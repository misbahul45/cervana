export interface ScrollState {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

const TOLERANCE = 1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function overflows(state: ScrollState): boolean {
  return state.scrollWidth - state.clientWidth > TOLERANCE;
}

export function thumbMetrics(
  state: ScrollState,
  trackWidth: number,
  minThumb = 40,
): { visible: boolean; width: number; left: number } {
  if (!overflows(state) || trackWidth <= 0) return { visible: false, width: 0, left: 0 };
  const width = clamp((state.clientWidth / state.scrollWidth) * trackWidth, Math.min(minThumb, trackWidth), trackWidth);
  const maxScroll = state.scrollWidth - state.clientWidth;
  const progress = clamp(state.scrollLeft / maxScroll, 0, 1);
  return { visible: true, width, left: (trackWidth - width) * progress };
}

export function scrollLeftForThumb(thumbLeft: number, state: ScrollState, trackWidth: number, thumbWidth: number): number {
  const room = trackWidth - thumbWidth;
  if (room <= 0) return 0;
  const maxScroll = Math.max(0, state.scrollWidth - state.clientWidth);
  return clamp(thumbLeft / room, 0, 1) * maxScroll;
}

export function edges(state: ScrollState): { atStart: boolean; atEnd: boolean } {
  if (!overflows(state)) return { atStart: true, atEnd: true };
  return {
    atStart: state.scrollLeft <= TOLERANCE,
    atEnd: state.scrollLeft >= state.scrollWidth - state.clientWidth - TOLERANCE,
  };
}

export function pageStep(clientWidth: number): number {
  return Math.max(120, Math.round(clientWidth * 0.8));
}
