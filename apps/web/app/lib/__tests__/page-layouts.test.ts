import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = join(__dirname, '..', '..', 'pages');

const vueFilesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return vueFilesUnder(full);
    return entry.name.endsWith('.vue') ? [full] : [];
  });

export const pagesWrappingALayout = (files: ReadonlyArray<{ path: string; source: string }>): string[] =>
  files.filter(({ source }) => /<NuxtLayout[\s>]/.test(source)).map(({ path }) => path);

describe('pages never wrap a layout themselves', () => {
  it('finds a page that nests NuxtLayout, so the check is not vacuous', () => {
    const offenders = pagesWrappingALayout([
      { path: 'a.vue', source: '<template>\n  <NuxtLayout name="learn"><NuxtPage /></NuxtLayout>\n</template>' },
      { path: 'b.vue', source: '<template><NuxtLayout>\n<NuxtPage/></NuxtLayout></template>' },
      { path: 'c.vue', source: '<template><NuxtPage /></template>' },
    ]);

    expect(offenders).toEqual(['a.vue', 'b.vue']);
  });

  it('has no page under pages/ that renders NuxtLayout: a layout nested inside a page freezes the child route, so the URL changes but the screen does not', () => {
    const files = vueFilesUnder(PAGES_DIR).map((path) => ({ path: relative(PAGES_DIR, path), source: readFileSync(path, 'utf8') }));

    expect(pagesWrappingALayout(files)).toEqual([]);
  });
});

export const parentsWithoutOutlet = (files: ReadonlyArray<{ path: string; source: string }>, hasChildren: (path: string) => boolean): string[] =>
  files.filter(({ path, source }) => hasChildren(path) && !/<NuxtPage[\s/>]/.test(source)).map(({ path }) => path);

describe('page files with a same-named folder are parents', () => {
  it('finds a parent that never renders its child route, so the check is not vacuous', () => {
    const offenders = parentsWithoutOutlet(
      [
        { path: 'orders/[id].vue', source: '<template><main>detail</main></template>' },
        { path: 'my-learning.vue', source: '<template><NuxtPage /></template>' },
        { path: 'plain.vue', source: '<template><main /></template>' },
      ],
      (path) => path !== 'plain.vue',
    );

    expect(offenders).toEqual(['orders/[id].vue']);
  });

  it('has no page that hides its nested pages by forgetting NuxtPage: the URL changes but the child never shows', () => {
    const files = vueFilesUnder(PAGES_DIR).map((path) => ({ path, source: readFileSync(path, 'utf8') }));
    const hasChildren = (path: string) => existsSync(path.replace(/\.vue$/, ''));

    expect(parentsWithoutOutlet(files, hasChildren).map((path) => relative(PAGES_DIR, path))).toEqual([]);
  });
});
