import type { ResolvedTheme } from './resolve';

export interface CssVars {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

const TOKEN_TO_CSS: Readonly<Record<string, string>> = {
  bg: '--rc-bg',
  surface: '--rc-surface',
  fg: '--rc-fg',
  muted: '--rc-muted',
  border: '--rc-border',
  borderStrong: '--rc-border-strong',
  primary: '--rc-primary',
  primaryFg: '--rc-primary-fg',
  secondary: '--rc-secondary',
  secondaryFg: '--rc-secondary-fg',
  accent: '--rc-accent',
  focus: '--rc-focus',
  foam: '--rc-foam',
  sand: '--rc-sand',
};

export function toCssVars(resolved: ResolvedTheme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [token, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    const value = (resolved.tokens as Record<string, string | undefined>)[token];
    if (typeof value === 'string') out[cssVar] = value;
  }
  if (resolved.atmosphere.particles?.enabled === false) {
    out['--rc-particles'] = '0';
  }
  if (resolved.atmosphere.motion?.intensity !== undefined) {
    out['--rc-motion-intensity'] = String(resolved.atmosphere.motion.intensity);
  }
  if (resolved.atmosphere.waves === false) {
    out['--rc-waves'] = '0';
  }
  return out;
}
