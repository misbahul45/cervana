import { Injectable } from '@nestjs/common';
import {
  HEX_REGEX,
  themeSchemePairSchema,
  atmosphereSchema,
  type ThemeAtmosphere,
  type ThemeTokens,
} from './theme.schema';

export type Mood = 'calm' | 'energetic' | 'analytical' | 'welcoming' | 'playful' | 'serious' | 'mysterious' | 'natural';

const MOOD_HUE_BASE: Record<Mood, number> = {
  calm: 200,
  energetic: 30,
  analytical: 220,
  welcoming: 25,
  playful: 320,
  serious: 230,
  mysterious: 280,
  natural: 130,
};

export interface ThemeProposalInput {
  name: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  mood?: Mood[];
  keywords?: string[];
  intensity?: number;
}

export interface ThemeProposal {
  slug: string;
  title: string;
  primary: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
  mood: Mood[];
  tokens: { light: ThemeTokens; dark: ThemeTokens };
  atmosphere: ThemeAtmosphere;
  variants: {
    PRACTICE?: { atmosphere?: ThemeAtmosphere };
    CHALLENGE?: { atmosphere?: ThemeAtmosphere };
    EXAM?: { atmosphere?: ThemeAtmosphere };
  };
}

@Injectable()
export class ThemeProposerService {
  propose(input: ThemeProposalInput): ThemeProposal {
    const slug = this.toSlug(input.name);
    const mood: Mood[] = (input.mood && input.mood.length > 0) ? input.mood : ['calm'];
    const intensity = this.clamp(input.intensity ?? 0.5, 0, 1);

    const hueBase = this.dominantHue(mood);
    const accentHue = (hueBase + 30) % 360;
    const lightPrimaryL = this.bumpLightness(0.26, intensity * 0.02);
    const darkPrimaryL = this.bumpLightness(0.65, intensity * 0.04);
    const darkSurfaceL = this.bumpLightness(0.1, intensity * 0.02);

    const tokens = {
      light: {
        bg: this.hslToHex(hueBase, 0.3, 0.97),
        surface: this.hslToHex(hueBase, 0.2, 1.0),
        fg: this.hslToHex(hueBase, 0.4, 0.1),
        muted: this.hslToHex(hueBase, 0.2, 0.3),
        border: this.hslToHex(hueBase, 0.3, 0.75),
        borderStrong: this.hslToHex(hueBase, 0.3, 0.45),
        primary: this.hslToHex(hueBase, 0.6, lightPrimaryL),
        primaryFg: this.hslToHex(hueBase, 0.2, 0.98),
        secondary: this.hslToHex(accentHue, 0.5, lightPrimaryL),
        secondaryFg: this.hslToHex(accentHue, 0.2, 0.98),
        accent: this.hslToHex(accentHue, 0.3, 0.3),
        focus: this.hslToHex(hueBase, 0.7, 0.25),
        foam: this.hslToHex(hueBase, 0.3, 0.92),
        sand: this.hslToHex(40, 0.5, 0.85),
      },
      dark: {
        bg: this.hslToHex(hueBase, 0.5, darkSurfaceL),
        surface: this.hslToHex(hueBase, 0.45, darkSurfaceL + 0.04),
        fg: this.hslToHex(hueBase, 0.3, 0.95),
        muted: this.hslToHex(hueBase, 0.25, 0.7),
        border: this.hslToHex(hueBase, 0.4, 0.3),
        borderStrong: this.hslToHex(hueBase, 0.4, 0.55),
        primary: this.hslToHex(hueBase, 0.55, darkPrimaryL),
        primaryFg: this.hslToHex(hueBase, 0.4, 0.08),
        secondary: this.hslToHex(accentHue, 0.55, darkPrimaryL),
        secondaryFg: this.hslToHex(accentHue, 0.4, 0.05),
        accent: this.hslToHex(accentHue, 0.5, 0.75),
        focus: this.hslToHex(hueBase, 0.7, 0.65),
        foam: this.hslToHex(hueBase, 0.4, 0.25),
        sand: this.hslToHex(40, 0.4, 0.3),
      },
    };

    const result: ThemeProposal = {
      slug,
      title: input.name,
      primary: tokens.light.primary,
      secondary: tokens.light.secondary,
      tertiary: tokens.light.accent,
      quaternary: tokens.light.foam,
      mood,
      tokens,
      atmosphere: atmosphereSchema.parse({
        particles: { enabled: true, density: Math.min(0.6, intensity * 0.5) },
        motion: { intensity },
        lighting: { intensity: this.bumpLightness(intensity, 0.05) },
        waves: true,
        caustics: true,
      }),
      variants: this.buildVariants(tokens, intensity),
    };

    themeSchemePairSchema.parse(result.tokens);

    return result;
  }

  private buildVariants(
    _tokens: { light: ThemeTokens; dark: ThemeTokens },
    intensity: number,
  ): ThemeProposal['variants'] {
    return {
      PRACTICE: {
        atmosphere: {
          particles: { density: Math.max(0.1, intensity * 0.3) },
          motion: { intensity: intensity * 0.6 },
          lighting: { intensity: intensity * 0.85 },
          waves: false,
        },
      },
      CHALLENGE: {
        atmosphere: {
          particles: { density: Math.max(0.05, intensity * 0.15) },
          motion: { intensity: intensity * 0.4 },
          lighting: { intensity: intensity * 0.55 },
          waves: false,
        },
      },
      EXAM: {
        atmosphere: {
          particles: { enabled: false, density: 0 },
          motion: { intensity: 0 },
          lighting: { intensity: 0 },
          waves: false,
          caustics: false,
        },
      },
    };
  }

  private dominantHue(mood: Mood[]): number {
    const avg = mood.reduce((sum, m) => sum + MOOD_HUE_BASE[m], 0) / mood.length;
    return Math.round(avg) % 360;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private bumpLightness(value: number, delta: number): number {
    return this.clamp(value + delta, 0, 1);
  }

  private hslToHex(hue: number, saturation: number, lightness: number): string {
    const h = ((hue % 360) + 360) % 360;
    const s = this.clamp(saturation, 0, 1);
    const l = this.clamp(lightness, 0, 1);

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const toHex = (v: number) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0');

    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    if (!HEX_REGEX.test(hex)) {
      throw new Error(`proposer produced invalid hex ${hex}`);
    }
    return hex;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }
}
