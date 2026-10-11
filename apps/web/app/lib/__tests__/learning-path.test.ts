import { describe, expect, it } from 'vitest';
import { buildPathNodes, pathOffset, pathSummary } from '~/lib/learning-path';

const sub = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Bagian ${id}`,
  description: null,
  isUnlocked: true,
  progress: null,
  _count: { lessons: 3 },
  ...overrides,
});

describe('buildPathNodes', () => {
  it('marks an unlocked, unfinished part as available and links it to its lessons', () => {
    const [node] = buildPathNodes([sub('a')]);

    expect(node).toMatchObject({ id: 'a', title: 'Bagian a', state: 'current', to: '/my-learning/sub-topics/a', lessons: 3 });
  });

  it('marks a locked part as locked and gives it no link', () => {
    const nodes = buildPathNodes([sub('a', { progress: { status: 'COMPLETED' } }), sub('b', { isUnlocked: false })]);

    expect(nodes[1]).toMatchObject({ state: 'locked', to: null });
  });

  it('marks a finished part as done and keeps it reachable for review', () => {
    const [node] = buildPathNodes([sub('a', { progress: { status: 'COMPLETED' } })]);

    expect(node).toMatchObject({ state: 'done', to: '/my-learning/sub-topics/a' });
  });

  it('points at exactly one current part: the first unlocked one that is not finished', () => {
    const nodes = buildPathNodes([
      sub('a', { progress: { status: 'COMPLETED' } }),
      sub('b'),
      sub('c'),
    ]);

    expect(nodes.map((n) => n.state)).toEqual(['done', 'current', 'available']);
  });

  it('has no current part once everything is finished, and none while everything is locked', () => {
    expect(buildPathNodes([sub('a', { progress: { status: 'COMPLETED' } })]).some((n) => n.state === 'current')).toBe(false);
    expect(buildPathNodes([sub('a', { isUnlocked: false })]).some((n) => n.state === 'current')).toBe(false);
  });

  it('orders parts by sortOrder when the server provides one, keeping input order otherwise', () => {
    const ordered = buildPathNodes([sub('b', { sortOrder: 2 }), sub('a', { sortOrder: 1 })]);
    expect(ordered.map((n) => n.id)).toEqual(['a', 'b']);

    const plain = buildPathNodes([sub('x'), sub('y')]);
    expect(plain.map((n) => n.id)).toEqual(['x', 'y']);
  });

  it('turns a description into plain text and drops markup', () => {
    const [node] = buildPathNodes([sub('a', { description: '<p>Dasar <b>jurnal</b></p><script>alert(1)</script>' })]);

    expect(node?.summary).toBe('Dasar jurnal');
  });

  it('copes with a missing list, a missing lesson count and a missing title', () => {
    expect(buildPathNodes(undefined)).toEqual([]);
    expect(buildPathNodes(null)).toEqual([]);
    const [node] = buildPathNodes([{ id: 'z', isUnlocked: true } as never]);
    expect(node).toMatchObject({ title: 'Tanpa judul', lessons: 0 });
  });
});

describe('pathOffset', () => {
  it('walks a gentle wave and repeats', () => {
    const wave = Array.from({ length: 8 }, (_, index) => pathOffset(index));

    expect(wave).toEqual([0, 1, 2, 1, 0, -1, -2, -1]);
    expect(pathOffset(8)).toBe(pathOffset(0));
    expect(pathOffset(11)).toBe(pathOffset(3));
  });

  it('is zero for a negative or invalid index', () => {
    expect(pathOffset(-1)).toBe(0);
    expect(pathOffset(Number.NaN)).toBe(0);
  });
});

describe('pathSummary', () => {
  it('counts finished parts and a rounded percentage', () => {
    const nodes = buildPathNodes([sub('a', { progress: { status: 'COMPLETED' } }), sub('b'), sub('c', { isUnlocked: false }), sub('d', { progress: { status: 'COMPLETED' } })]);

    expect(pathSummary(nodes)).toEqual({ total: 4, done: 2, percent: 50 });
  });

  it('is zero for an empty path instead of dividing by zero', () => {
    expect(pathSummary([])).toEqual({ total: 0, done: 0, percent: 0 });
  });
});
