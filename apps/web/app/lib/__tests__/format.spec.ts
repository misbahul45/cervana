import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMoney } from '~/lib/format';

describe('formatMoney', () => {
  it('formats decimal strings from the API as rupiah', () => {
    expect(formatMoney('49000.00')).toMatch(/Rp\s?49\.000/);
    expect(formatMoney(199000)).toMatch(/Rp\s?199\.000/);
  });

  it('shows zero as free instead of a misleading amount', () => {
    expect(formatMoney('0.00')).toBe('Gratis');
  });

  it('never invents a number for missing or malformed input', () => {
    expect(formatMoney(null)).toBe('-');
    expect(formatMoney(undefined)).toBe('-');
    expect(formatMoney('abc')).toBe('-');
  });
});

describe('date formatting', () => {
  it('renders the same text on any machine by pinning the Jakarta time zone', () => {
    expect(formatDateTime('2026-10-08T17:30:00.000Z')).toBe(formatDateTime('2026-10-08T17:30:00.000Z'));
    expect(formatDateTime('2026-10-08T17:30:00.000Z')).toContain('9 Okt 2026');
    expect(formatDateTime('2026-10-08T17:30:00.000Z')).toContain('00.30');
    expect(formatDate('2026-10-08T17:30:00.000Z')).toContain('2026');
  });

  it('returns a dash for invalid dates', () => {
    expect(formatDateTime('nope')).toBe('-');
    expect(formatDate(null)).toBe('-');
  });
});
