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
