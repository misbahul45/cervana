import { describe, expect, it } from 'vitest';
import { patchFilters, readFilters, writeQuery, type FilterDefs } from '~/lib/query-filters';

const defs = {
  page: { kind: 'page' },
  q: { kind: 'text', max: 10 },
  status: { kind: 'enum', values: ['A', 'B'] },
} satisfies FilterDefs;

describe('readFilters', () => {
  it('fills the defaults when the URL says nothing', () => {
    expect(readFilters({}, defs)).toEqual({ page: 1, q: '', status: '' });
  });

  it('reads valid values from the query', () => {
    expect(readFilters({ page: '3', q: 'maya', status: 'B' }, defs)).toEqual({ page: 3, q: 'maya', status: 'B' });
  });

  it('falls back instead of trusting a malformed or hostile URL', () => {
    expect(readFilters({ page: '-4', q: 'x', status: 'C' }, defs)).toMatchObject({ page: 1, status: '' });
    expect(readFilters({ page: 'abc' }, defs).page).toBe(1);
    expect(readFilters({ page: '2.5' }, defs).page).toBe(1);
    expect(readFilters({ page: '99999999999' }, defs).page).toBe(1);
  });

  it('takes the first value of a repeated key, trims text and cuts it at the limit', () => {
    expect(readFilters({ q: ['  abcdefghijklmnop ', 'second'] }, defs).q).toBe('abcdefghij');
    expect(readFilters({ status: ['A', 'B'] }, defs).status).toBe('A');
  });

  it('ignores keys that are not declared', () => {
    expect(Object.keys(readFilters({ page: '2', where: '{}', include: 'x' }, defs)).sort()).toEqual(['page', 'q', 'status']);
  });
});

describe('writeQuery', () => {
  it('leaves out everything that equals its default so URLs stay clean', () => {
    expect(writeQuery({ page: 1, q: '', status: '' }, defs)).toEqual({});
    expect(writeQuery({ page: 2, q: 'maya', status: 'A' }, defs)).toEqual({ page: '2', q: 'maya', status: 'A' });
  });
});

describe('patchFilters', () => {
  it('applies a change and goes back to page one when a filter other than the page changes', () => {
    expect(patchFilters({ page: 4, q: '', status: '' }, { status: 'A' }, defs)).toEqual({ page: 1, q: '', status: 'A' });
    expect(patchFilters({ page: 4, q: 'x', status: 'A' }, { q: 'y' }, defs).page).toBe(1);
  });

  it('keeps the page when only the page changes', () => {
    expect(patchFilters({ page: 1, q: 'x', status: '' }, { page: 3 }, defs)).toEqual({ page: 3, q: 'x', status: '' });
  });

  it('sanitises the patch with the same rules as reading', () => {
    expect(patchFilters({ page: 1, q: '', status: '' }, { status: 'ZZZ', page: 0 }, defs)).toEqual({ page: 1, q: '', status: '' });
  });
});
