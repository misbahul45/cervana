import { computed, type Ref } from 'vue';
import type { NormalizedTheme, ThemeVariantKey, ColorScheme } from '~/theme/types';
import { resolveTheme, type ResolvedTheme } from '~/theme/resolve';
import { toCssVars } from '~/theme/css-vars';
import { DEFAULT_THEME } from '~/theme/default-theme';

interface ComposableOptions {
  step?: NormalizedTheme | null;
  lesson?: NormalizedTheme | null;
  subTopic?: NormalizedTheme | null;
  topic?: NormalizedTheme | null;
  variant?: Ref<ThemeVariantKey> | ThemeVariantKey;
  scheme?: Ref<ColorScheme> | ColorScheme;
  reducedMotion?: Ref<boolean> | boolean;
}

export function useResolvedTheme(options: ComposableOptions = {}) {
  const variant = computed<ThemeVariantKey>(() =>
    typeof options.variant === 'object' && 'value' in options.variant ? options.variant.value : (options.variant ?? 'LEARN'),
  );
  const scheme = computed<ColorScheme>(() =>
    typeof options.scheme === 'object' && 'value' in options.scheme ? options.scheme.value : (options.scheme ?? 'light'),
  );
  const reducedMotion = computed<boolean>(() =>
    typeof options.reducedMotion === 'object' && 'value' in options.reducedMotion ? options.reducedMotion.value : Boolean(options.reducedMotion),
  );

  const resolved = computed<ResolvedTheme>(() =>
    resolveTheme({
      chain: [options.step, options.lesson, options.subTopic, options.topic],
      variant: variant.value,
      scheme: scheme.value,
      reducedMotion: reducedMotion.value,
      fallback: DEFAULT_THEME,
    }),
  );

  const cssVars = computed(() => toCssVars(resolved.value));

  const style = computed(() => {
    const lines: string[] = [];
    for (const [name, value] of Object.entries(cssVars.value)) {
      lines.push(`${name}: ${value}`);
    }
    return lines.join('; ');
  });

  const dataAttributes = computed(() => ({
    'data-rc-theme': resolved.value.meta.slug,
    'data-rc-variant': resolved.value.meta.variant,
    'data-rc-scheme': resolved.value.meta.scheme,
    'data-rc-motion': resolved.value.meta.reducedMotion ? 'off' : 'on',
  }));

  return {
    resolved,
    cssVars,
    style,
    dataAttributes,
  };
}
