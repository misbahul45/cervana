import { describe, expect, it } from 'vitest';
import { insertBlock, prefixLines, wrapSelection } from '~/lib/editor';

describe('wrapSelection', () => {
  it('wraps the selected text and keeps it selected', () => {
    const result = wrapSelection('halo dunia', 5, 10, '**', '**', 'tebal');

    expect(result.text).toBe('halo **dunia**');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('dunia');
  });

  it('inserts the placeholder when nothing is selected', () => {
    const result = wrapSelection('halo ', 5, 5, '*', '*', 'miring');

    expect(result.text).toBe('halo *miring*');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('miring');
  });

  it('survives a reversed or out of range selection', () => {
    expect(wrapSelection('abc', 99, 1, '[', ']', 'x').text).toBe('a[bc]');
    expect(wrapSelection('', 0, 0, '`', '`', 'kode').text).toBe('`kode`');
  });

  it('never duplicates the document, unlike appending the whole text', () => {
    const body = 'satu dua tiga';

    expect(wrapSelection(body, 0, 4, '**', '**', 'x').text.length).toBe(body.length + 4);
  });
});

describe('prefixLines', () => {
  it('prefixes every line the selection touches', () => {
    const result = prefixLines('a\nb\nc', 0, 3, '- ');

    expect(result.text).toBe('- a\n- b\nc');
  });

  it('prefixes the current line for a caret', () => {
    expect(prefixLines('satu\ndua', 6, 6, '> ').text).toBe('satu\n> dua');
  });

  it('numbers lines with a function prefix', () => {
    expect(prefixLines('a\nb', 0, 3, (index) => `${index + 1}. `).text).toBe('1. a\n2. b');
  });
});

describe('insertBlock', () => {
  it('puts a block on its own lines in the middle of text', () => {
    const result = insertBlock('atas bawah', 4, '## Judul');

    expect(result.text).toBe('atas\n\n## Judul\n bawah');
  });

  it('does not add a blank lead at the start and leaves the caret after the block', () => {
    const result = insertBlock('', 0, '---');

    expect(result.text).toBe('---\n');
    expect(result.selectionStart).toBe(result.text.length);
  });

  it('reuses an existing blank line', () => {
    expect(insertBlock('a\n\n', 3, '---').text).toBe('a\n\n---\n');
  });
});
