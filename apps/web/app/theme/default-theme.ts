import oceanThemeJson from './reducera-ocean.theme.json';
import { normalizeTheme } from './normalize';
import type { NormalizedTheme } from './types';

export const DEFAULT_THEME: NormalizedTheme = (() => {
  const parsed = normalizeTheme(oceanThemeJson);
  if (!parsed) {
    throw new Error('Bundled reducera-ocean.theme.json failed to normalize');
  }
  return parsed;
})();
