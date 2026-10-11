export const THEME_ICON_NAMES = [
  'streak',
  'xp',
  'star',
  'level',
  'badge',
  'league',
  'freeze',
  'node',
  'lock',
  'trophy',
] as const;

export type ThemeIconName = (typeof THEME_ICON_NAMES)[number];

export interface BundledThemeIcon {
  name: ThemeIconName;
  fileId: string;
  url: string;
}

export const isThemeIconName = (value: string): value is ThemeIconName =>
  (THEME_ICON_NAMES as ReadonlyArray<string>).includes(value);

export const bundledIconUrl = (slug: string, name: ThemeIconName): string => `/themes/${slug}/icons/${name}.svg`;

export const defaultThemeIcons = (slug: string): BundledThemeIcon[] =>
  THEME_ICON_NAMES.map((name) => ({ name, fileId: `bundled:${slug}:${name}`, url: bundledIconUrl(slug, name) }));
