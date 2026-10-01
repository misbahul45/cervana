import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export interface EvaluationScores {
  correctness: number;
  grounding: number;
  pedagogy: number;
  personalization: number;
  difficultyAlign: number;
}

export interface EvaluationResult {
  episodeId: string;
  scores: EvaluationScores;
  overall: number;
}

export const EVALUATION_WEIGHTS: Readonly<Record<keyof EvaluationScores, number>> = {
  correctness: 0.35,
  grounding: 0.20,
  pedagogy: 0.20,
  personalization: 0.15,
  difficultyAlign: 0.10,
};

export const EVALUATION_THRESHOLDS: Readonly<Record<'acceptable' | 'good' | 'excellent', number>> = {
  acceptable: 0.55,
  good: 0.7,
  excellent: 0.85,
};

@Injectable()
export class PerInteractionEvaluatorService {
  private readonly logger = new Logger(PerInteractionEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(args: {
    episodeId: string;
    scores: EvaluationScores;
    judgeModel?: string;
    judgeVersion?: string;
  }): Promise<EvaluationResult> {
    const overall = this.weightedOverall(args.scores);
    const judgeModel = args.judgeModel ?? 'reducera.per-interaction.v1';
    const judgeVersion = args.judgeVersion ?? '1.0.0';

    await this.prisma.interactionEvaluation.upsert({
      where: { episodeId: args.episodeId },
      create: {
        episodeId: args.episodeId,
        judgeModel,
        judgeVersion,
        ...args.scores,
        overallScore: overall,
      },
      update: {
        ...args.scores,
        judgeModel,
        judgeVersion,
        overallScore: overall,
      },
    });

    if (args.episodeId) {
      await this.prisma.episode.update({
        where: { id: args.episodeId },
        data: {
          evaluationScore: overall,
          evaluationJson: args.scores as never,
        },
      });
    }

    return { episodeId: args.episodeId, scores: args.scores, overall };
  }

  async evaluateFromEpisode(episodeId: string): Promise<EvaluationResult | null> {
    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) return null;
    const scores = this.deriveScoresFromEpisode(episode);
    return this.evaluate({ episodeId, scores });
  }

  weightedOverall(scores: EvaluationScores): number {
    let total = 0;
    for (const key of Object.keys(EVALUATION_WEIGHTS) as Array<keyof EvaluationScores>) {
      total += scores[key] * EVALUATION_WEIGHTS[key];
    }
    return Math.max(0, Math.min(1, total));
  }

  classify(overall: number): 'acceptable' | 'good' | 'excellent' {
    if (overall >= EVALUATION_THRESHOLDS.excellent) return 'excellent';
    if (overall >= EVALUATION_THRESHOLDS.good) return 'good';
    return 'acceptable';
  }

  private deriveScoresFromEpisode(episode: {
    inputPayload: unknown;
    response: string;
    retrievedChunks: unknown;
  }): EvaluationScores {
    const input = (episode.inputPayload as Record<string, unknown> | null) ?? null;
    const wasCorrect = input?.['wasCorrect'] === true;
    const text = (episode.response ?? '').toString();
    const chunks = episode.retrievedChunks;

    const correctness = wasCorrect ? 1 : 0.5;
    const grounding = chunks && Object.keys(chunks as object).length > 0 ? 0.7 : 0.4;
    const pedagogy = text.length > 50 ? 0.7 : 0.4;
    const personalization = input?.['recentTopic'] ? 0.8 : 0.5;
    const difficultyAlign = 0.7;

    return { correctness, grounding, pedagogy, personalization, difficultyAlign };
  }
}

@Injectable()
export class FrozenBenchmarkService {
  private readonly logger = new Logger(FrozenBenchmarkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(args: {
    name: string;
    version: number;
    description?: string;
    examples: Array<Record<string, unknown>>;
  }) {
    const existing = await this.prisma.evaluationDataset.findUnique({
      where: { name_version: { name: args.name, version: args.version } },
    });
    if (existing && existing.isFrozen) {
      this.logger.warn(`Frozen benchmark ${args.name}@${args.version} already exists, cannot re-register`);
      return existing;
    }
    return this.prisma.evaluationDataset.upsert({
      where: { name_version: { name: args.name, version: args.version } },
      create: {
        name: args.name,
        version: args.version,
        isFrozen: true,
        description: args.description ?? null,
        examplesJson: args.examples as never,
      },
      update: {
        isFrozen: true,
        description: args.description ?? null,
        examplesJson: args.examples as never,
      },
    });
  }

  async run(args: { name: string; version: number; predictions: Array<{ inputId: string; output: string }> }) {
    const benchmark = await this.prisma.evaluationDataset.findUnique({
      where: { name_version: { name: args.name, version: args.version } },
    });
    if (!benchmark) throw new Error(`benchmark ${args.name}@${args.version} not found`);
    if (!benchmark.isFrozen) {
      throw new Error(`benchmark ${args.name}@${args.version} is not frozen`);
    }

    const examples = (benchmark.examplesJson as Array<Record<string, unknown>>) ?? [];
    const matched: Array<{ inputId: string; expected: unknown; actual: string }> = [];
    for (const prediction of args.predictions) {
      const expected = examples.find((e) => e['inputId'] === prediction.inputId);
      if (expected) {
        matched.push({ inputId: prediction.inputId, expected, actual: prediction.output });
      }
    }

    const correctCount = matched.filter((m) => this.matchesExpected(m.actual, m.expected)).length;
    const totalScored = matched.length || 1;

    return {
      benchmarkId: benchmark.id,
      name: benchmark.name,
      version: benchmark.version,
      passRate: correctCount / totalScored,
      samplesScored: matched.length,
      samplesTotal: args.predictions.length,
    };
  }

  private matchesExpected(actual: string, expected: unknown): boolean {
    if (typeof expected === 'string') {
      return actual.toLowerCase().includes(expected.toLowerCase());
    }
    if (expected && typeof expected === 'object' && 'contains' in (expected as { contains?: string })) {
      return actual.toLowerCase().includes(String((expected as { contains: string }).contains).toLowerCase());
    }
    return false;
  }
}
