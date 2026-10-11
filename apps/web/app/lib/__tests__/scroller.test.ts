import { describe, expect, it } from 'vitest';
import { edges, overflows, pageStep, scrollLeftForThumb, thumbMetrics } from '~/lib/scroller';

const state = (scrollLeft: number, clientWidth = 300, scrollWidth = 900) => ({ scrollLeft, clientWidth, scrollWidth });

describe('overflows', () => {
  it('is true only when there is content to scroll to', () => {
    expect(overflows(state(0))).toBe(true);
    expect(overflows(state(0, 300, 300))).toBe(false);
    expect(overflows(state(0, 300, 300.5))).toBe(false);
    expect(overflows(state(0, 0, 0))).toBe(false);
  });
});

describe('thumbMetrics', () => {
  it('sizes the thumb by how much of the content is visible and keeps it at the start when not scrolled', () => {
    expect(thumbMetrics(state(0), 240)).toEqual({ visible: true, width: 80, left: 0 });
  });

  it('puts the thumb at the end of the track when scrolled all the way', () => {
    expect(thumbMetrics(state(600), 240)).toEqual({ visible: true, width: 80, left: 160 });
  });

  it('moves the thumb in proportion to the scroll position', () => {
    expect(thumbMetrics(state(300), 240).left).toBe(80);
  });

  it('never makes the thumb smaller than the minimum, however long the content', () => {
    const result = thumbMetrics(state(0, 300, 30000), 240, 48);

    expect(result.width).toBe(48);
  });

  it('is hidden when nothing overflows or the track has no width yet', () => {
    expect(thumbMetrics(state(0, 300, 300), 240).visible).toBe(false);
    expect(thumbMetrics(state(0), 0).visible).toBe(false);
  });

  it('clamps an overscrolled position into the track', () => {
    expect(thumbMetrics(state(-50), 240).left).toBe(0);
    expect(thumbMetrics(state(5000), 240).left).toBe(160);
  });
});

describe('scrollLeftForThumb', () => {
  it('is the inverse of thumbMetrics at the start, middle and end', () => {
    const track = 240;
    for (const scrollLeft of [0, 300, 600]) {
      const { left, width } = thumbMetrics(state(scrollLeft), track);

      expect(scrollLeftForThumb(left, state(0), track, width)).toBeCloseTo(scrollLeft);
    }
  });

  it('stays inside the scrollable range when the thumb is dragged past either end', () => {
    expect(scrollLeftForThumb(-40, state(0), 240, 80)).toBe(0);
    expect(scrollLeftForThumb(999, state(0), 240, 80)).toBe(600);
  });

  it('does not divide by zero when the thumb fills the track', () => {
    expect(scrollLeftForThumb(10, state(0), 240, 240)).toBe(0);
  });
});

describe('edges', () => {
  it('knows when it is at the start, in the middle and at the end', () => {
    expect(edges(state(0))).toEqual({ atStart: true, atEnd: false });
    expect(edges(state(300))).toEqual({ atStart: false, atEnd: false });
    expect(edges(state(600))).toEqual({ atStart: false, atEnd: true });
  });

  it('tolerates sub-pixel rounding at the end', () => {
    expect(edges(state(599.4)).atEnd).toBe(true);
  });

  it('is at both edges when nothing overflows', () => {
    expect(edges(state(0, 300, 300))).toEqual({ atStart: true, atEnd: true });
  });
});

describe('pageStep', () => {
  it('moves about four fifths of the visible width, never less than a readable minimum', () => {
    expect(pageStep(500)).toBe(400);
    expect(pageStep(50)).toBe(120);
  });
});
