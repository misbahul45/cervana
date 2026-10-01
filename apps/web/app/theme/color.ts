export type RGB = readonly [number, number, number];

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandHex(value: string): string {
  const match = HEX.exec(value);
  if (!match) return value;
  const raw = match[1] ?? '';
  if (raw.length === 3) {
    const [r = '', g = '', b = ''] = raw;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return `#${raw}`;
}

export function parseHex(value: string): RGB | null {
  if (typeof value !== 'string') return null;
  if (!HEX.test(value)) return null;
  const hex = expandHex(value).replace('#', '');
  if (hex.length !== 6) return null;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: RGB): number {
  const channels = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return 1;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function withAlpha(hex: string, alphaPercent: number): string {
  const clamped = Math.max(0, Math.min(100, alphaPercent));
  const alpha = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  const base = expandHex(hex);
  if (base.length !== 7) return hex;
  return `${base}${alpha}`;
}
