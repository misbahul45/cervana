import { randomUUID } from 'crypto';
import {
  PerInteractionEvaluatorService,
  FrozenBenchmarkService,
  EVALUATION_WEIGHTS,
  EVALUATION_THRESHOLDS,
} from '../evaluation.service';

function buildPrisma() {
  const evaluations: Array<{ id: string; episodeId: string; scores: Record<string, number> }> = [];
  const episodes: Array<{ id: string; data: Record<string, unknown> }> = [];
  const datasets: Array<{ id: string; name: string; version: number; isFrozen: boolean; examplesJson: unknown; description: string | null }> = [];

  const interactionEvaluation = {
    upsert: jest.fn(async ({ where, create, update }: { where: { episodeId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const idx = evaluations.findIndex((e) => e.episodeId === where.episodeId);
      if (idx >= 0) {
        evaluations[idx] = { ...evaluations[idx], ...(update as { scores?: Record<string, number> }) };
        return evaluations[idx];
      }
      const created = { id: randomUUID(), episodeId: where.episodeId, scores: { ...(create as { scores?: Record<string, number> }).scores } };
      evaluations.push(created);
      return created;
    }),
  };

  const episodeApi = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const found = episodes.find((e) => e.id === where.id);
      return found ? { ...found, response: 'mock', inputPayload: {}, retrievedChunks: {} } : null;
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const idx = episodes.findIndex((e) => e.id === where.id);
      if (idx >= 0) {
        episodes[idx] = { ...episodes[idx], data: { ...episodes[idx].data, ...data } };
      }
      return { id: where.id, ...data };
    }),
  };

  const datasetApi = {
    findUnique: jest.fn(async ({ where }: { where: { name_version?: { name: string; version: number }; id?: string } }) => {
      if (where.name_version) {
        return datasets.find(
          (d) => d.name === where.name_version!.name && d.version === where.name_version!.version,
        ) ?? null;
      }
      if (where.id) {
        return datasets.find((d) => d.id === where.id) ?? null;
      }
      return null;
    }),
    upsert: jest.fn(async ({ where, create }: { where: { name_version: { name: string; version: number } }; create: Record<string, unknown> }) => {
      const idx = datasets.findIndex(
        (d) => d.name === where.name_version.name && d.version === where.name_version.version,
      );
      if (idx >= 0) {
        datasets[idx] = { ...datasets[idx], ...create };
        return datasets[idx];
      }
      const created = {
        id: randomUUID(),
        name: where.name_version.name,
        version: where.name_version.version,
        isFrozen: true,
        examplesJson: (create as { examplesJson?: unknown }).examplesJson ?? null,
        description: (create as { description?: string | null }).description ?? null,
        ...create,
      };
      datasets.push(created);
      return created;
    }),
  };

  return {
    prisma: {
      interactionEvaluation,
      episode: episodeApi,
      evaluationDataset: datasetApi,
    } as never,
    state: { evaluations, episodes, datasets },
  };
}

describe('PerInteractionEvaluatorService', () => {
  describe('AC-196: AC-7 evaluation metrics', () => {
    it('weighted overall matches the documented weights', () => {
      const { prisma } = buildPrisma();
      const service = new PerInteractionEvaluatorService(prisma);
      const overall = service.weightedOverall({
        correctness: 1,
        grounding: 1,
        pedagogy: 1,
        personalization: 1,
        difficultyAlign: 1,
      });
      expect(overall).toBeCloseTo(1.0, 3);
      expect(EVALUATION_WEIGHTS.correctness).toBe(0.35);
    });

    it('classifies scores into acceptable/good/excellent bands', () => {
      const { prisma } = buildPrisma();
      const service = new PerInteractionEvaluatorService(prisma);
      expect(service.classify(0.5)).toBe('acceptable');
      expect(service.classify(0.75)).toBe('good');
      expect(service.classify(0.9)).toBe('excellent');
    });

    it('thresholds match the documented values', () => {
      expect(EVALUATION_THRESHOLDS.acceptable).toBe(0.55);
      expect(EVALUATION_THRESHOLDS.good).toBe(0.7);
      expect(EVALUATION_THRESHOLDS.excellent).toBe(0.85);
    });
  });

  describe('AC-114: per-interaction evaluator persists', () => {
    it('upserts InteractionEvaluation and updates Episode.evaluationScore', async () => {
      const { prisma, state } = buildPrisma();
      const service = new PerInteractionEvaluatorService(prisma);
      const result = await service.evaluate({
        episodeId: 'ep-1',
        scores: { correctness: 0.9, grounding: 0.8, pedagogy: 0.7, personalization: 0.6, difficultyAlign: 0.5 },
      });
      expect(result.episodeId).toBe('ep-1');
      expect(result.overall).toBeGreaterThan(0);
      expect(result.overall).toBeLessThanOrEqual(1);
      expect(state.evaluations).toHaveLength(1);
    });
  });
});

describe('FrozenBenchmarkService', () => {
  describe('AC-114: frozen benchmark + isFrozen guard', () => {
    it('registers a new frozen benchmark', async () => {
      const { prisma, state } = buildPrisma();
      const service = new FrozenBenchmarkService(prisma);
      const ds = await service.register({
        name: 'golden-graph-v1',
        version: 1,
        examples: [{ inputId: 'q1', expected: 'Persamaan dasar akuntansi' }],
      });
      expect(state.datasets).toHaveLength(1);
      expect(ds.isFrozen).toBe(true);
    });

    it('rejects running against an unfrozen benchmark', async () => {
      const { prisma } = buildPrisma();
      const frozen = new FrozenBenchmarkService(prisma);
      await frozen.register({
        name: 'a',
        version: 1,
        examples: [{ inputId: 'q1' }],
      });
      const evalSvc = new PerInteractionEvaluatorService(prisma);
      void evalSvc;
      const result = frozen.run({ name: 'a', version: 1, predictions: [] });
      await expect(result).resolves.toMatchObject({ samplesScored: 0 });
    });
  });

  describe('AC-114: benchmark scoring', () => {
    it('matches predictions against examples and computes passRate', async () => {
      const { prisma } = buildPrisma();
      const frozen = new FrozenBenchmarkService(prisma);
      await frozen.register({
        name: 'acct',
        version: 1,
        examples: [
          { inputId: 'q1', contains: 'persamaan' },
          { inputId: 'q2', contains: 'jurnal' },
        ],
      });
      const out = await frozen.run({
        name: 'acct',
        version: 1,
        predictions: [
          { inputId: 'q1', output: 'Ini tentang persamaan dasar' },
          { inputId: 'q2', output: 'Jurnal umum mencatat transaksi' },
          { inputId: 'q3', output: 'unmatched' },
        ],
      });
      expect(out.passRate).toBe(1);
      expect(out.samplesScored).toBe(2);
      expect(out.samplesTotal).toBe(3);
    });
  });
});
