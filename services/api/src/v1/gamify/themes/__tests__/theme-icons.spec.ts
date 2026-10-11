import { THEME_ICON_NAMES, bundledIconUrl, defaultThemeIcons, isThemeIconName } from '../theme-icons';

describe('theme icon vocabulary', () => {
  it('is the closed set of ten gamification names', () => {
    expect([...THEME_ICON_NAMES]).toEqual(['streak', 'xp', 'star', 'level', 'badge', 'league', 'freeze', 'node', 'lock', 'trophy']);
  });

  it('recognises only names of the vocabulary', () => {
    expect(isThemeIconName('streak')).toBe(true);
    expect(isThemeIconName('trophy')).toBe(true);
    expect(isThemeIconName('Streak')).toBe(false);
    expect(isThemeIconName('rocket')).toBe(false);
    expect(isThemeIconName('')).toBe(false);
  });

  it('points each bundled icon at a first party svg of the theme', () => {
    expect(bundledIconUrl('reducera-play', 'streak')).toBe('/themes/reducera-play/icons/streak.svg');
  });

  it('gives the default theme one icon per name with a stable file id', () => {
    const icons = defaultThemeIcons('reducera-play');

    expect(icons.map((icon) => icon.name)).toEqual([...THEME_ICON_NAMES]);
    for (const icon of icons) {
      expect(icon.fileId).toBe(`bundled:reducera-play:${icon.name}`);
      expect(icon.url).toBe(`/themes/reducera-play/icons/${icon.name}.svg`);
    }
  });
});
