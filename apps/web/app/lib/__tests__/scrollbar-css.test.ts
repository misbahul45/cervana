import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', '..', 'assets', 'css', 'play.css'), 'utf8');

describe('scrollbar styling', () => {
  it('styles the thumb as a rounded pill that follows the theme tokens, in light and dark alike', () => {
    expect(css).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*border-radius:\s*999px/);
    expect(css).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*var\(--rc-primary\)/);
    expect(css).toMatch(/::-webkit-scrollbar-thumb:hover\s*\{[^}]*var\(--rc-primary\)/);
  });

  it('offers the standard properties (apart from hiding a carousel track) only to browsers without webkit scrollbars, because Chromium ignores the pill styling once they are set', () => {
    const block = /@supports not selector\(::-webkit-scrollbar\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';

    expect(block).toContain('scrollbar-width: thin');
    expect(block).toContain('scrollbar-color');
    const outside = css.replace(/@supports not selector\(::-webkit-scrollbar\)\s*\{[\s\S]*?\n\}/, '');
    expect(outside).not.toMatch(/scrollbar-color:/);
    expect(outside).not.toMatch(/scrollbar-width:\s*(thin|auto)/);
  });

  it('stops animating the thumb for people who asked for reduced motion', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*::-webkit-scrollbar-thumb\s*\{\s*transition:\s*none/);
  });
});
