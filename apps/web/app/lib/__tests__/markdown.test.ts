import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '~/lib/markdown';

describe('renderMarkdown', () => {
  it('renders ordinary markdown', () => {
    const html = renderMarkdown('# Judul\n\nIsi **tebal** dan _miring_.\n\n- satu\n- dua');

    expect(html).toContain('<h1>Judul</h1>');
    expect(html).toContain('<strong>tebal</strong>');
    expect(html).toContain('<em>miring</em>');
    expect(html).toContain('<li>satu</li>');
  });

  it('escapes raw HTML instead of passing it through, so generated text cannot run script', () => {
    const html = renderMarkdown('Halo <script>alert(1)</script> <img src=x onerror=alert(1)> <b onclick="x()">b</b>');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b onclick');
    expect(html).toContain('&lt;script&gt;');
  });

  it('refuses javascript: links', () => {
    const html = renderMarkdown('[klik](javascript:alert(1))');

    expect(html).not.toContain('href="javascript:');
  });

  it('turns a bare address into a link and an empty text into an empty string', () => {
    expect(renderMarkdown('lihat https://example.test/a')).toContain('<a href="https://example.test/a"');
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});
