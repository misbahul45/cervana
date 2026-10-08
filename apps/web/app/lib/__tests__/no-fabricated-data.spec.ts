import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP_ROOT = join(__dirname, '..', '..');
const LITERAL_QUERY = /queryFn:\s*async\s*\(\)\s*=>\s*(\(\s*[\[{]|\[)/;
const LITERAL_PROMISE = /Promise\.resolve\(\[/;
const FORBIDDEN_CALLS = [
  /\$fetch\(\s*[`'"]\/v1\//,
  /localStorage\.getItem\(\s*['"]access_token['"]\s*\)/,
  /setTimeout\([^)]*navigateTo/,
];

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' || entry === 'node_modules' ? [] : vueFiles(full);
    return full.endsWith('.vue') ? [full] : [];
  });
}

const files = [...vueFiles(join(APP_ROOT, 'pages')), ...vueFiles(join(APP_ROOT, 'components')), ...vueFiles(join(APP_ROOT, 'layouts'))];

describe('pages never present invented data as real', () => {
  it('flags every page backed by a literal fixture with a preview notice', () => {
    const offenders = files
      .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ source }) => LITERAL_QUERY.test(source) || LITERAL_PROMISE.test(source))
      .filter(({ source }) => !source.includes('<PreviewNotice'))
      .map(({ file }) => relative(APP_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('does not call unreachable or insecure endpoints directly', () => {
    const offenders = files
      .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ source }) => FORBIDDEN_CALLS.some((pattern) => pattern.test(source)))
      .map(({ file }) => relative(APP_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('leaves no route defined by both a parent file and a shadowing sibling', () => {
    const pagesDir = join(APP_ROOT, 'pages');
    const shadowed = vueFiles(pagesDir)
      .map((file) => relative(pagesDir, file))
      .filter((file) => !file.endsWith('index.vue'))
      .filter((file) => {
        const sibling = join(pagesDir, file.replace(/\.vue$/, ''), 'index.vue');
        try {
          statSync(sibling);
        } catch {
          return false;
        }
        return !readFileSync(join(pagesDir, file), 'utf8').includes('<NuxtPage');
      });

    expect(shadowed).toEqual([]);
  });

  it('has one dynamic page per directory so routes cannot compete', () => {
    const pagesDir = join(APP_ROOT, 'pages');
    const byDirectory = new Map<string, string[]>();
    for (const file of vueFiles(pagesDir)) {
      const rel = relative(pagesDir, file);
      const name = rel.split('/').pop() ?? '';
      if (!/^\[[^\]]+\]\.vue$/.test(name)) continue;
      const dir = rel.slice(0, rel.length - name.length);
      byDirectory.set(dir, [...(byDirectory.get(dir) ?? []), name]);
    }
    const competing = [...byDirectory].filter(([, names]) => names.length > 1).map(([dir]) => dir);

    expect(competing).toEqual([]);
  });
});
