import type { DefaultThemePayload } from '~/theme/default-payload';

export default defineNuxtPlugin(async () => {
  const payload = useState<DefaultThemePayload | null>('rc-default-theme', () => null);
  if (payload.value) return;
  try {
    payload.value = await $fetch<DefaultThemePayload>('/_rc/theme/default');
  } catch {
    payload.value = null;
  }
});
