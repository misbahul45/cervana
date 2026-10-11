import { createDefaultThemeLoader } from '~/theme/default-loader';
import { parseDefaultThemeResponse } from '~/theme/default-payload';
import { DEFAULT_THEME } from '~/theme/default-theme';

const FETCH_TIMEOUT_MS = 800;

const loader = createDefaultThemeLoader({
  fetchRemote: async () => {
    const config = useRuntimeConfig();
    const response = await $fetch(`${config.apiInternalUrl}/api/v1/gamify/themes/default`, { timeout: FETCH_TIMEOUT_MS });
    return parseDefaultThemeResponse(response);
  },
  fallback: () => ({ theme: DEFAULT_THEME, icons: [] }),
});

export const getDefaultTheme = () => loader.get();

export const _resetDefaultThemeCacheForTests = () => loader.reset();
