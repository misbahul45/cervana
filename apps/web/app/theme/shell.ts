import type { ColorScheme, NormalizedTheme, ThemeVariantKey } from './types';
import { resolveTheme } from './resolve';
import { toCssVars } from './css-vars';
import { DEFAULT_THEME } from './default-theme';

export interface ShellThemeInput {
  chain: ReadonlyArray<NormalizedTheme | null | undefined>;
  variant: ThemeVariantKey;
  scheme: ColorScheme;
  reducedMotion: boolean;
}

export interface ShellBindings {
  style: string;
  attrs: Record<string, string>;
}

export function shellBindings(input: ShellThemeInput): ShellBindings {
  if (!input.chain.some(Boolean)) {
    return {
      style: '',
      attrs: {
        'data-rc-theme': DEFAULT_THEME.slug,
        'data-rc-variant': input.variant,
        'data-rc-motion': 'on',
      },
    };
  }

  const resolved = resolveTheme({ ...input, fallback: DEFAULT_THEME });
  const style = Object.entries(toCssVars(resolved))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');

  return {
    style,
    attrs: {
      'data-rc-theme': resolved.meta.slug,
      'data-rc-variant': resolved.meta.variant,
      'data-rc-scheme': resolved.meta.scheme,
      'data-rc-motion': resolved.meta.reducedMotion ? 'off' : 'on',
    },
  };
}

export interface ShellRender {
  attrs: Record<string, string>;
  style: string;
  darkCss: string;
}

const SAFE_SLUG = /^[a-z0-9-]+$/;
const SAFE_DECLARATION = /^--rc-[a-z-]+:\s*[#\w\s.,%()-]+$/;

export function darkStylesheet(slug: string, style: string): string {
  if (!SAFE_SLUG.test(slug) || !style) return '';
  const declarations = style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => SAFE_DECLARATION.test(declaration) && !/url\(|expression\(/i.test(declaration))
    .map((declaration) => `${declaration} !important`);
  if (!declarations.length) return '';
  return `.dark [data-rc-theme="${slug}"] { ${declarations.join('; ')}; }`;
}

export function shellRender(input: Omit<ShellThemeInput, 'scheme'>): ShellRender {
  const light = shellBindings({ ...input, scheme: 'light' });
  const dark = shellBindings({ ...input, scheme: 'dark' });
  const { 'data-rc-scheme': _scheme, ...attrs } = light.attrs;
  return {
    attrs,
    style: light.style,
    darkCss: darkStylesheet(attrs['data-rc-theme'] ?? '', dark.style),
  };
}
