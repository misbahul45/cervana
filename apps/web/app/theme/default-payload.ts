import { normalizeTheme } from './normalize';
import type { ThemeIconRecord } from './icons';
import type { NormalizedTheme } from './types';

export interface DefaultThemePayload {
  theme: NormalizedTheme;
  icons: ThemeIconRecord[];
}

const toIcons = (value: unknown): ThemeIconRecord[] => {
  if (!Array.isArray(value)) return [];
  const out: ThemeIconRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== 'string' || raw.name.trim() === '') continue;
    out.push({ name: raw.name, imageIcon: raw.imageIcon as ThemeIconRecord['imageIcon'] });
  }
  return out;
};

export const parseDefaultThemeResponse = (payload: unknown): DefaultThemePayload | null => {
  if (!payload || typeof payload !== 'object') return null;
  const envelope = payload as Record<string, unknown>;
  const root = 'data' in envelope ? envelope.data : payload;
  if (!root || typeof root !== 'object') return null;

  const theme = normalizeTheme(root);
  if (!theme) return null;
  return { theme, icons: toIcons((root as Record<string, unknown>).icons) };
};
