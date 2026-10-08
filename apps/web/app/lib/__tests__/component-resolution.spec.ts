import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB_ROOT = join(__dirname, '..', '..', '..');
const APP_ROOT = join(WEB_ROOT, 'app');
const REGISTRY = join(WEB_ROOT, '.nuxt', 'components.d.ts');

const BUILT_IN = new Set([
  'NuxtLink',
  'NuxtPage',
  'NuxtLayout',
  'NuxtImg',
  'NuxtPicture',
  'NuxtErrorBoundary',
  'NuxtLoadingIndicator',
  'NuxtRouteAnnouncer',
  'ClientOnly',
  'RouterLink',
  'Teleport',
  'Transition',
  'TransitionGroup',
  'KeepAlive',
  'Suspense',
  'Motion',
  'Icon',
]);

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return ['__tests__', 'node_modules'].includes(entry) ? [] : vueFiles(full);
    return full.endsWith('.vue') ? [full] : [];
  });
}

function registeredNames(): Set<string> {
  const source = readFileSync(REGISTRY, 'utf8');
  return new Set([...source.matchAll(/export const (\w+):/g)].map((match) => match[1]!));
}

function usedTags(source: string): string[] {
  const start = source.indexOf('<template');
  const end = source.lastIndexOf('</template>');
  const template = start === -1 ? '' : source.slice(start, end === -1 ? undefined : end);
  const tags = [...template.matchAll(/<([A-Z][A-Za-z0-9]+)[\s/>]/g)].map((match) => match[1]!);
  return [...new Set(tags)];
}

describe.skipIf(!existsSync(REGISTRY))('component resolution', () => {
  it('registers every component tag the templates use', () => {
    const registered = registeredNames();
    const unresolved: string[] = [];

    for (const file of [...vueFiles(join(APP_ROOT, 'pages')), ...vueFiles(join(APP_ROOT, 'layouts')), ...vueFiles(join(APP_ROOT, 'components')), join(APP_ROOT, 'app.vue')]) {
      const source = readFileSync(file, 'utf8');
      for (const tag of usedTags(source)) {
        if (BUILT_IN.has(tag) || registered.has(tag)) continue;
        if (/^U[A-Z]/.test(tag)) continue;
        if (new RegExp(`import\\s+(?:type\\s+)?\\{?[^;]*\\b${tag}\\b[^;]*\\}?\\s+from`).test(source)) continue;
        if (!source.includes(`<${tag}`)) continue;
        unresolved.push(`${relative(APP_ROOT, file)} -> <${tag}>`);
      }
    }

    expect(unresolved).toEqual([]);
  });
});
