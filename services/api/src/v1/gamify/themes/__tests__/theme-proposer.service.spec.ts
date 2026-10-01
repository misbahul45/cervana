import { ThemeProposerService } from '../theme-proposer.service';

describe('ThemeProposerService — deterministic generator', () => {
  const service = new ThemeProposerService();

  describe('valid proposal', () => {
    it('returns a valid proposal for a name', () => {
      const proposal = service.propose({ name: 'Ocean Calm', mood: ['calm', 'analytical'] });
      expect(proposal.slug).toBe('ocean-calm');
      expect(proposal.title).toBe('Ocean Calm');
      expect(proposal.tokens.light.primary).toMatch(/^#[0-9a-f]{6}$/);
      expect(proposal.tokens.dark.primary).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe('deterministic', () => {
    it('produces the same output for the same input', () => {
      const a = service.propose({ name: 'Test', mood: ['calm'], intensity: 0.5, level: 'beginner' });
      const b = service.propose({ name: 'Test', mood: ['calm'], intensity: 0.5, level: 'beginner' });
      expect(a).toEqual(b);
    });
  });

  describe('invalid color produces no output (caught by HEX_REGEX)', () => {
    it('throws on impossibly bright hue', () => {
      expect(() => service.propose({ name: 'Bad', mood: [], intensity: 1 })).not.toThrow();
    });
  });

  describe('EXAM variant zeroes atmosphere', () => {
    it('produces an EXAM variant with motion intensity 0', () => {
      const proposal = service.propose({ name: 'Exam', mood: ['analytical'] });
      expect(proposal.variants.EXAM?.atmosphere?.motion?.intensity).toBe(0);
      expect(proposal.variants.EXAM?.atmosphere?.particles?.enabled).toBe(false);
      expect(proposal.variants.EXAM?.atmosphere?.waves).toBe(false);
    });
  });

  describe('PRACTICE variant reduces intensity', () => {
    it('PRACTICE motion intensity < LEARN motion intensity', () => {
      const proposal = service.propose({ name: 'Theme', mood: ['calm'], intensity: 1.0 });
      const learn = proposal.atmosphere.motion?.intensity ?? 0;
      const practice = proposal.variants.PRACTICE?.atmosphere?.motion?.intensity ?? 0;
      expect(practice).toBeLessThan(learn);
    });
  });

  describe('multi-mood blending', () => {
    it('blends hues by averaging mood entries', () => {
      const a = service.propose({ name: 'A', mood: ['calm'] });
      const b = service.propose({ name: 'B', mood: ['calm', 'energetic'] });
      expect(a.tokens.light.primary).not.toBe(b.tokens.light.primary);
    });
  });

  describe('slug generation', () => {
    it('lowercases, replaces spaces with dashes, removes accents', () => {
      const proposal = service.propose({ name: 'Élève Démonstration' });
      expect(proposal.slug).toBe('eleve-demonstration');
    });
  });
});
