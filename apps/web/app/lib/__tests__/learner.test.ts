import { describe, expect, it } from 'vitest';
import { nextConceptCopy, type NextConceptView } from '~/lib/learner';

const view = (overrides: Partial<NextConceptView> = {}): NextConceptView => ({
  conceptId: 'c1',
  level: 1,
  reasonCodes: ['PREREQUISITES_MET'],
  concept: { id: 'c1', title: 'Persamaan Akuntansi', level: 1 },
  ...overrides,
});

describe('nextConceptCopy', () => {
  it('names the concept and explains why in plain Indonesian', () => {
    const copy = nextConceptCopy(view());

    expect(copy.title).toBe('Persamaan Akuntansi');
    expect(copy.reason).toBe('Prasyaratmu sudah terpenuhi, saatnya konsep ini.');
    expect(copy.done).toBe(false);
  });

  it('has a reason for every code the api can return', () => {
    for (const code of ['NO_CONCEPTS', 'NO_EVIDENCE_START', 'PREREQUISITES_MET', 'CONTINUE_PRACTICE', 'UNREACHABLE_PREREQUISITES', 'ALL_CONCEPTS_PASSED'] as const) {
      expect(nextConceptCopy(view({ reasonCodes: [code] })).reason.length).toBeGreaterThan(10);
    }
  });

  it('starts a new learner at the beginning', () => {
    expect(nextConceptCopy(view({ reasonCodes: ['NO_EVIDENCE_START'] })).reason).toBe('Mulai dari dasar, satu konsep dulu.');
  });

  it('celebrates when everything is passed and has no concept to continue with', () => {
    const copy = nextConceptCopy(view({ conceptId: null, level: null, concept: null, reasonCodes: ['ALL_CONCEPTS_PASSED'] }));

    expect(copy.done).toBe(true);
    expect(copy.title).toBe('Semua konsep sudah lulus');
  });

  it('is empty-safe when there are no concepts', () => {
    const copy = nextConceptCopy(view({ conceptId: null, level: null, concept: null, reasonCodes: ['NO_CONCEPTS'] }));

    expect(copy.done).toBe(false);
    expect(copy.title).toBe('Belum ada konsep');
  });

  it('uses the first reason code when there are several', () => {
    expect(nextConceptCopy(view({ reasonCodes: ['CONTINUE_PRACTICE', 'PREREQUISITES_MET'] })).reason).toBe('Kamu sedang di tengah konsep ini, lanjutkan latihannya.');
  });
});
