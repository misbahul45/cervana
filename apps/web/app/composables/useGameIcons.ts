import { computed } from 'vue';
import type { DefaultThemePayload } from '~/theme/default-payload';
import { resolveIconUrl, type ThemeIconName, type ThemeIconSet } from '~/theme/icons';

export function useGameIcons() {
  const payload = useState<DefaultThemePayload | null>('rc-default-theme', () => null);
  const defaultIcons = computed<ThemeIconSet>(() => payload.value?.icons ?? []);

  const urlFor = (name: ThemeIconName, preferred: ReadonlyArray<ThemeIconSet> = []): string =>
    resolveIconUrl(name, [...preferred, defaultIcons.value]);

  return { urlFor, defaultIcons };
}
