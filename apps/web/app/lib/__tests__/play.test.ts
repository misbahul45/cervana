import { describe, expect, it } from 'vitest';
import { buttonClasses, dayStateLabel, progressWidth, ringDash } from '~/lib/play';

describe('buttonClasses', () => {
  it('is the plain button for the defaults', () => {
    expect(buttonClasses({})).toEqual(['rc-btn']);
  });

  it('adds a modifier for each variant but the primary one', () => {
    expect(buttonClasses({ variant: 'primary' })).toEqual(['rc-btn']);
    for (const variant of ['secondary', 'danger', 'gold', 'outline', 'ghost'] as const) {
      expect(buttonClasses({ variant })).toEqual(['rc-btn', `rc-btn--${variant}`]);
    }
  });

  it('adds size and block modifiers in a stable order', () => {
    expect(buttonClasses({ variant: 'outline', size: 'lg', block: true })).toEqual(['rc-btn', 'rc-btn--outline', 'rc-btn--lg', 'rc-btn--block']);
    expect(buttonClasses({ size: 'sm' })).toEqual(['rc-btn', 'rc-btn--sm']);
    expect(buttonClasses({ size: 'md' })).toEqual(['rc-btn']);
  });
});

describe('progressWidth', () => {
  it('is a percent between 0 and 100', () => {
    expect(progressWidth(42)).toBe('42%');
    expect(progressWidth(-5)).toBe('0%');
    expect(progressWidth(180)).toBe('100%');
    expect(progressWidth(Number.NaN)).toBe('0%');
  });
});

describe('ringDash', () => {
  it('draws the filled part of a ring from the circumference', () => {
    const { circumference, offset } = ringDash(0.25, 40);

    expect(circumference).toBeCloseTo(2 * Math.PI * 40, 6);
    expect(offset).toBeCloseTo(circumference * 0.75, 6);
  });

  it('is empty at 0, full at 1 and clamps outside', () => {
    expect(ringDash(0, 10).offset).toBeCloseTo(ringDash(0, 10).circumference, 6);
    expect(ringDash(1, 10).offset).toBe(0);
    expect(ringDash(2, 10).offset).toBe(0);
    expect(ringDash(-1, 10).offset).toBeCloseTo(ringDash(0, 10).circumference, 6);
  });
});

describe('dayStateLabel', () => {
  it('names every calendar state in Indonesian', () => {
    expect(dayStateLabel('done')).toBe('Selesai');
    expect(dayStateLabel('frozen')).toBe('Dibekukan');
    expect(dayStateLabel('missed')).toBe('Terlewat');
    expect(dayStateLabel('today')).toBe('Hari ini');
  });
});
