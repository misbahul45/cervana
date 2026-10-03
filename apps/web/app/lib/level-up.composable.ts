import { useState } from '#app';

export function useLevelUpToast() {
  const shown = useState<number | null>('lastShownLevel', () => null);
  async function check(currentLevel: number) {
    if (shown.value !== null && currentLevel > shown.value) {
      shown.value = currentLevel;
      return currentLevel;
    }
    shown.value = currentLevel;
    return null;
  }
  return { check, shown };
}