import { ACCEPTANCE_GATES, PromptOptimizationService } from '../prompt-optimization.service';

function buildPrisma() {
  const prompts: Array<{
    id: string;
    name: string;
    version: number;
    status: string;
    metricsJson: Record<string, unknown> | null;
    parametersJson: Record<string, unknown> | null;
  }> = [];

  return {
    prisma: {
      promptVersion: {
        findUnique: jest.fn(async ({ where }: { where: { name_version: { name: string; version: number } } }) => {
          return prompts.find(
            (p) => p.name === where.name_version.name && p.version === where.name_version.version,
          ) ?? null;
        }),
        create: jest.fn(async ({ data }: { data: { name: string; version: number; body: string; modelName: string; status: string } }) => {
          const created = { id: `pv-${data.name}-${data.version}`, ...data, metricsJson: null, parametersJson: null };
          prompts.push(created);
          return created;
        }),
        update: jest.fn(async ({ where, data }: { where: { id?: string; name_version?: { name: string; version: number } }; data: Record<string, unknown> }) => {
          const filter = where.id
            ? (p: typeof prompts[number]) => p.id === where.id
            : (p: typeof prompts[number]) => p.name === where.name_version!.name && p.version === where.name_version!.version;
          const idx = prompts.findIndex(filter);
          if (idx >= 0) {
            prompts[idx] = { ...prompts[idx], ...data };
            return prompts[idx];
          }
          return null;
        }),
      },
    } as never,
    state: { prompts },
  };
}

describe('PromptOptimizationService — global optimization governance', () => {
  describe('AC-191: candidate → offline benchmark → regression → human gate → canary', () => {
    it('AC-191: accepts candidate that beats baseline by >=5% passRate', async () => {
      const { prisma } = buildPrisma();
      const service = new PromptOptimizationService(prisma);
      const result = await service.evaluateGate({
        candidateName: 'tutor.v1',
        candidateVersion: 2,
        baseline: { passRate: 0.7, p95LatencyMs: 800, costPerEpisode: 0.5, acceptanceRate: 0.85 },
        candidate: { passRate: 0.78, p95LatencyMs: 800, costPerEpisode: 0.5, acceptanceRate: 0.85 },
      });
      expect(result.accepted).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('AC-191: rejects candidate with p95 latency regression > 1.5x', async () => {
      const { prisma } = buildPrisma();
      const service = new PromptOptimizationService(prisma);
      const result = await service.evaluateGate({
        candidateName: 'tutor.v1',
        candidateVersion: 2,
        baseline: { passRate: 0.7, p95LatencyMs: 800, costPerEpisode: 0.5, acceptanceRate: 0.85 },
        candidate: { passRate: 0.8, p95LatencyMs: 1500, costPerEpisode: 0.5, acceptanceRate: 0.85 },
      });
      expect(result.accepted).toBe(false);
      expect(result.reasons.some((r) => r.includes('latency'))).toBe(true);
    });

    it('AC-191: rejects candidate with cost regression > 1.5x', async () => {
      const { prisma } = buildPrisma();
      const service = new PromptOptimizationService(prisma);
      const result = await service.evaluateGate({
        candidateName: 'tutor.v1',
        candidateVersion: 2,
        baseline: { passRate: 0.7, p95LatencyMs: 800, costPerEpisode: 0.5, acceptanceRate: 0.85 },
        candidate: { passRate: 0.8, p95LatencyMs: 800, costPerEpisode: 1.0, acceptanceRate: 0.85 },
      });
      expect(result.accepted).toBe(false);
      expect(result.reasons.some((r) => r.includes('cost'))).toBe(true);
    });
  });

  describe('AC-191: documentation matches constants', () => {
    it('gate thresholds match documentation', () => {
      expect(ACCEPTANCE_GATES.passRateMin).toBe(0.05);
      expect(ACCEPTANCE_GATES.p95LatencyMax).toBe(1.5);
      expect(ACCEPTANCE_GATES.costPerEpisodeMax).toBe(1.5);
      expect(ACCEPTANCE_GATES.acceptanceRateMin).toBe(0.7);
    });
  });

  describe('AC-191: promote / rollback', () => {
    it('promote sets status to PUBLISHED', async () => {
      const { prisma, state } = buildPrisma();
      const service = new PromptOptimizationService(prisma);
      await service.submitCandidate({ name: 'tutor.v1', version: 2, body: 'new prompt', modelName: 'gpt-x' });
      const promoted = await service.promote({
        candidateName: 'tutor.v1',
        candidateVersion: 2,
        approvedBy: 'human.reviewer',
      });
      expect(promoted.status).toBe('PUBLISHED');
      expect(state.prompts.find((p) => p.version === 2)?.metricsJson).toEqual({ approvedBy: 'human.reviewer' });
    });
  });
});
