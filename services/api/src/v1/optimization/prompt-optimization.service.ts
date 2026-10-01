import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export type OptimizationStatus = 'CANDIDATE' | 'CANARY' | 'PROMOTED' | 'ROLLED_BACK';

export interface OptimizationMetrics {
  passRate: number;
  p95LatencyMs: number;
  costPerEpisode: number;
  acceptanceRate: number;
}

export const ACCEPTANCE_GATES = {
  passRateMin: 0.05,
  p95LatencyMax: 1.5,
  costPerEpisodeMax: 1.5,
  acceptanceRateMin: 0.7,
} as const;

@Injectable()
export class PromptOptimizationService {
  private readonly logger = new Logger(PromptOptimizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitCandidate(args: {
    name: string;
    version: number;
    body: string;
    modelName: string;
    notes?: string;
  }) {
    return this.prisma.promptVersion.create({
      data: {
        name: args.name,
        version: args.version,
        body: args.body,
        modelName: args.modelName,
        status: 'DRAFT' as never,
        temperature: null,
        createdBy: 'optimization.runner',
        metricsJson: args.notes ? { notes: args.notes } as never : undefined,
      },
    });
  }

  async evaluateGate(args: {
    candidateName: string;
    candidateVersion: number;
    baseline: OptimizationMetrics;
    candidate: OptimizationMetrics;
  }): Promise<{
    accepted: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    const passRateImprovement = args.candidate.passRate - args.baseline.passRate;
    if (passRateImprovement < ACCEPTANCE_GATES.passRateMin) {
      reasons.push(
        `passRate improvement ${passRateImprovement.toFixed(3)} below threshold ${ACCEPTANCE_GATES.passRateMin}`,
      );
    }

    const latencyRatio = args.candidate.p95LatencyMs / args.baseline.p95LatencyMs;
    if (latencyRatio > ACCEPTANCE_GATES.p95LatencyMax) {
      reasons.push(
        `p95 latency ratio ${latencyRatio.toFixed(2)} above threshold ${ACCEPTANCE_GATES.p95LatencyMax}`,
      );
    }

    const costRatio = args.candidate.costPerEpisode / args.baseline.costPerEpisode;
    if (costRatio > ACCEPTANCE_GATES.costPerEpisodeMax) {
      reasons.push(
        `cost ratio ${costRatio.toFixed(2)} above threshold ${ACCEPTANCE_GATES.costPerEpisodeMax}`,
      );
    }

    if (args.candidate.acceptanceRate < ACCEPTANCE_GATES.acceptanceRateMin) {
      reasons.push(
        `acceptance rate ${args.candidate.acceptanceRate} below threshold ${ACCEPTANCE_GATES.acceptanceRateMin}`,
      );
    }

    const accepted = reasons.length === 0;
    this.logger.log(
      `Gate evaluated candidate=${args.candidateName}@${args.candidateVersion} accepted=${accepted} reasons=${reasons.length}`,
    );
    return { accepted, reasons };
  }

  async recordCanaryResult(args: {
    candidateName: string;
    candidateVersion: number;
    sampleSize: number;
    passRate: number;
    rollback: boolean;
  }) {
    const prompt = await this.prisma.promptVersion.findUnique({
      where: { name_version: { name: args.candidateName, version: args.candidateVersion } },
    });
    if (!prompt) throw new Error('candidate not found');

    const nextStatus: OptimizationStatus = args.rollback ? 'ROLLED_BACK' : 'CANARY';
    await this.prisma.promptVersion.update({
      where: { id: prompt.id },
      data: {
        status: nextStatus as never,
        metricsJson: {
          canarySampleSize: args.sampleSize,
          canaryPassRate: args.passRate,
        } as never,
      },
    });

    if (!args.rollback) {
      await this.autoRollbackOnRegression({
        candidateName: args.candidateName,
        candidateVersion: args.candidateVersion,
        sampleSize: args.sampleSize,
        passRate: args.passRate,
      });
    }

    return { candidateName: args.candidateName, version: args.candidateVersion, status: nextStatus };
  }

  private async autoRollbackOnRegression(args: {
    candidateName: string;
    candidateVersion: number;
    sampleSize: number;
    passRate: number;
  }) {
    if (args.sampleSize >= 100 && args.passRate < 0.55) {
      this.logger.warn(
        `Auto-rollback triggered for ${args.candidateName}@${args.candidateVersion} sample=${args.sampleSize} passRate=${args.passRate}`,
      );
      await this.recordCanaryResult({ ...args, rollback: true });
    }
  }

  async promote(args: {
    candidateName: string;
    candidateVersion: number;
    approvedBy: string;
  }) {
    return this.prisma.promptVersion.update({
      where: { name_version: { name: args.candidateName, version: args.candidateVersion } },
      data: {
        status: 'PUBLISHED' as never,
        metricsJson: { approvedBy: args.approvedBy } as never,
      },
    });
  }
}
