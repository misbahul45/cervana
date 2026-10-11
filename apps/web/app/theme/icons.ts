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

export const ICON_LABELS: Readonly<Record<ThemeIconName, string>> = {
  streak: 'Streak',
  xp: 'XP',
  star: 'Bintang',
  level: 'Level',
  badge: 'Lencana',
  league: 'Peringkat',
  freeze: 'Pembeku streak',
  node: 'Konsep selesai',
  lock: 'Terkunci',
  trophy: 'Piala',
};

export const BUNDLED_THEME_SLUG = 'reducera-play';

export interface ThemeIconRecord {
  name: string;
  imageIcon?: string | { fileId?: string; url?: string } | null;
}

export type ThemeIconSet = ReadonlyArray<ThemeIconRecord> | null | undefined;

export const bundledIconUrl = (name: ThemeIconName): string => `/themes/${BUNDLED_THEME_SLUG}/icons/${name}.svg`;

const isSafeUrl = (value: string): boolean => (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('https://');

export const iconUrlFromRecord = (record: ThemeIconRecord): string | null => {
  const image = record.imageIcon;
  const url = typeof image === 'string' ? image : image?.url;
  if (!url || !isSafeUrl(url)) return null;
  return url;
};

const sameName = (record: ThemeIconRecord, name: ThemeIconName): boolean => record.name.trim().toLowerCase() === name;

export const resolveIconUrl = (name: ThemeIconName, sets: ReadonlyArray<ThemeIconSet>): string => {
  for (const set of sets) {
    for (const record of set ?? []) {
      if (!sameName(record, name)) continue;
      const url = iconUrlFromRecord(record);
      if (url) return url;
    }
  }
  return bundledIconUrl(name);
};

export const iconAlt = (name: ThemeIconName, options: { label?: string; decorative?: boolean } = {}): string => {
  if (options.decorative) return '';
  const label = options.label?.trim();
  return label ? label : ICON_LABELS[name];
};
