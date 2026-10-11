import playThemeJson from './reducera-play.theme.json';
import { normalizeTheme } from './normalize';
import type { NormalizedTheme } from './types';

export const DEFAULT_THEME: NormalizedTheme = (() => {
  const parsed = normalizeTheme(playThemeJson);
  if (!parsed) {
    throw new Error('Bundled reducera-play.theme.json failed to normalize');
  }
  return parsed;
})();
