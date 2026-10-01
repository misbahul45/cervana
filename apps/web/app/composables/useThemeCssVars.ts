import { computed, type ComputedRef } from 'vue';

interface ThemeLike {
  primary?: string | null;
  secondary?: string | null;
  tertiary?: string | null;
  quaternary?: string | null;
}

export function useThemeCssVars(theme: ComputedRef<ThemeLike | null | undefined>) {
  const style = computed(() => {
    const value = theme.value;
    if (!value) return '';
    const lines: string[] = [];
    if (value.primary) lines.push(`--rc-page-primary: ${value.primary}`);
    if (value.secondary) lines.push(`--rc-page-secondary: ${value.secondary}`);
    if (value.tertiary) lines.push(`--rc-page-tertiary: ${value.tertiary}`);
    if (value.quaternary) lines.push(`--rc-page-quaternary: ${value.quaternary}`);
    return lines.join('; ');
  });

  return { style };
}
