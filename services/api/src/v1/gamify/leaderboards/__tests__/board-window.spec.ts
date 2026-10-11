import { parseMembershipInput, weekWindow } from '../board-rules';

describe('weekWindow', () => {
  it('runs from Monday 00:00 to the next Monday 00:00 in Jakarta time', () => {
    const window = weekWindow(new Date('2026-10-10T05:00:00Z'));

    expect(window.startDate).toBe('2026-10-05');
    expect(window.start.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-10-11T17:00:00.000Z');
  });

  it('puts Sunday night in Jakarta into the old week and Monday morning into the new one', () => {
    expect(weekWindow(new Date('2026-10-11T16:59:59Z')).startDate).toBe('2026-10-05');
    expect(weekWindow(new Date('2026-10-11T17:00:00Z')).startDate).toBe('2026-10-12');
  });

  it('handles a month and a year boundary', () => {
    expect(weekWindow(new Date('2027-01-01T05:00:00Z')).startDate).toBe('2026-12-28');
    expect(weekWindow(new Date('2026-11-02T05:00:00Z')).startDate).toBe('2026-11-02');
  });
});

describe('parseMembershipInput', () => {
  it('accepts an opt in with a handle and normalises the handle to lowercase', () => {
    expect(parseMembershipInput({ optIn: true, handle: ' Budi_01 ' })).toEqual({ optIn: true, handle: 'budi_01' });
  });

  it('accepts a switch off without a handle, and a handle alone', () => {
    expect(parseMembershipInput({ optIn: false })).toEqual({ optIn: false });
    expect(parseMembershipInput({ handle: 'siti_77' })).toEqual({ handle: 'siti_77' });
  });

  it('refuses a handle outside 3 to 20 lowercase letters, digits and underscore', () => {
    for (const handle of ['ab', 'a'.repeat(21), 'budi 01', 'budi-01', 'bu.di', 'bùdi', '']) {
      expect(parseMembershipInput({ optIn: true, handle })).toBeNull();
    }
  });

  it('refuses an empty body, unknown keys and wrong types', () => {
    for (const bad of [{}, { optIn: 'yes' }, { optIn: true, role: 'ADMIN' }, null, 'x', { handle: 5 }]) {
      expect(parseMembershipInput(bad)).toBeNull();
    }
  });
});
