import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { MasteryService } from '../learner-model/services/mastery.service';
import { MisconceptionLifecycleService } from '../misconception/misconception-lifecycle.service';
import { QuestionUnderstandingService } from '../question-intelligence/question-understanding.service';
import { QuestionBlueprintService, ThreeValuedValidatorService } from '../question-intelligence/question-blueprint.service';
import { AdaptivePolicyService, type AdaptiveTutoringStrategy, type PolicyDecisionInput } from '../policy/adaptive-policy.service';
import { PersonalPolicyService, type PersonalPolicy, POLICY_RULES } from '../policy/personal-policy.service';

export interface TutorMessageInput {
  userId: string;
  sessionId?: string;
  text: string;
  domain: string;
  topicId?: string;
  recentTopic?: string;
  conceptKey?: string;
}

export interface TutorResponse {
  traceId: string;
  episodeId: string;
  intent: string;
  cognitiveDemand: string;
  strategy: string;
  difficultyTarget: number;
  scaffoldLevel: string;
  rationale: string;
  responseText: string;
  clarifyingQuestion?: string;
  suggestedPractice?: string;
  stopReason: 'OK' | 'CLARIFICATION_NEEDED' | 'HIGH_AMBIGUITY' | 'BUDGET';
  invariants: {
    difficultyInZone: boolean;
    masteryStable: boolean;
    policyEvidenceSufficient: boolean;
  };
  misconceptionHypotheses: Array<{ conceptKey: string; description: string; confidence: number }>;
  latencyMs: number;
}

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly misconception: MisconceptionLifecycleService,
    private readonly questionUnderstanding: QuestionUnderstandingService,
    private readonly blueprint: QuestionBlueprintService,
    private readonly threeValuedValidator: ThreeValuedValidatorService,
    private readonly adaptivePolicy: AdaptivePolicyService,
    private readonly personalPolicyService: PersonalPolicyService,
  ) {}

  async respond(input: TutorMessageInput): Promise<TutorResponse> {
    const start = Date.now();
    const traceId = randomUUID();

    const understanding = this.questionUnderstanding.understand({
      text: input.text,
      domain: input.domain,
      recentTopic: input.recentTopic,
      conceptIds: input.conceptKey ? [input.conceptKey] : [],
    });

    const masteryRow = input.conceptKey
      ? await this.prisma.topicMasteryRecord.findUnique({
          where: {
            userId_topicId: { userId: input.userId, topicId: input.topicId ?? input.conceptKey },
          },
        })
      : null;

    const openMisconceptions = await this.prisma.misconception.findMany({
      where: {
        userId: input.userId,
        status: { in: ['OPEN'] },
      },
    });

    const personalPolicy = await this.loadOrBuildPolicy(input.userId);

    const policyInput: PolicyDecisionInput = {
      intent: this.toPolicyIntent(understanding.intent),
      learner: {
        mastery: masteryRow?.score ?? 0.4,
        confidence: masteryRow?.confidence ?? 0.3,
        evidenceCount: masteryRow?.evidenceCount ?? 0,
        openMisconceptionCount: openMisconceptions.length,
        daysSinceLastReview: 0,
        consecutiveCorrect: 0,
        recentItemDifficulty: 0.5,
      },
      concept: {
        prerequisiteMasteryMet: true,
        isTransferEligible: understanding.cognitiveDemand === 'TRANSFER',
        difficulty: understanding.difficultyEstimate,
      },
      policy: personalPolicy,
    };

    const strategy = this.adaptivePolicy.decide(policyInput);

    const responseText = this.composeResponse(understanding, strategy);
    const stopReason = this.computeStopReason(understanding);

    const episode = await this.recordEpisode({
      userId: input.userId,
      sessionId: input.sessionId,
      traceId,
      understanding,
      strategy,
      responseText,
      latencyMs: Date.now() - start,
    });

    await this.recordDecisionTrace({
      traceId,
      userId: input.userId,
      sessionId: input.sessionId,
      taskId: episode.id,
      understanding,
      strategy,
      responseText,
      latencyMs: Date.now() - start,
    });

    return {
      traceId,
      episodeId: episode.id,
      intent: understanding.intent,
      cognitiveDemand: understanding.cognitiveDemand,
      strategy: strategy.strategy,
      difficultyTarget: strategy.difficultyTarget,
      scaffoldLevel: strategy.scaffoldLevel,
      rationale: strategy.rationale,
      responseText,
      clarifyingQuestion: understanding.clarifyingQuestion,
      suggestedPractice: this.suggestPractice(understanding, strategy),
      stopReason,
      invariants: {
        difficultyInZone: strategy.invariants.difficultyInZoneOfProximalDevelopment,
        masteryStable: strategy.invariants.masteryStable,
        policyEvidenceSufficient: strategy.invariants.policyEvidenceSufficient,
      },
      misconceptionHypotheses: understanding.misconceptionHypotheses,
      latencyMs: Date.now() - start,
    };
  }

  async recordAttemptOutcome(input: {
    userId: string;
    topicId: string;
    strategy: AdaptiveTutoringStrategy['strategy'];
    scoreDelta: number;
    wasCorrect: boolean;
    openMisconceptionKeys?: string[];
  }): Promise<PersonalPolicy> {
    const policy = await this.loadOrBuildPolicy(input.userId);
    const updated = this.personalPolicyService.recordOutcome(policy, {
      strategy: input.strategy,
      scoreDelta: input.scoreDelta,
      wasCorrect: input.wasCorrect,
    });
    await this.persistPolicy(updated);

    if (input.wasCorrect && input.openMisconceptionKeys && input.openMisconceptionKeys.length > 0) {
      for (const key of input.openMisconceptionKeys) {
        const existing = await this.prisma.misconception.findUnique({
          where: { userId_conceptKey: { userId: input.userId, conceptKey: key } },
        });
        if (!existing) continue;
        const outcome = this.misconception.classify({
          count: existing.count + 1,
          distinctEvidenceKeys: existing.count + 1,
          consecutiveCorrect: 0,
          daysSinceLastSeen: 0,
        });
        await this.prisma.misconception.update({
          where: { id: existing.id },
          data: { status: outcome.status as never, count: existing.count + 1, lastSeenAt: new Date() },
        });
      }
    }

    return updated;
  }

  private toPolicyIntent(intent: string): PolicyDecisionInput['intent'] {
    if (intent === 'CHALLENGE' || intent === 'TRANSFER' || intent === 'PRACTICE' ||
        intent === 'NEW_LEARNING' || intent === 'DOUBT') {
      return intent;
    }
    return 'NEW_LEARNING';
  }

  private composeResponse(
    understanding: ReturnType<QuestionUnderstandingService['understand']>,
    strategy: AdaptiveTutoringStrategy,
  ): string {
    if (understanding.clarifyingQuestion) {
      return understanding.clarifyingQuestion;
    }
    const verb = strategy.strategy.toLowerCase().replace(/_/g, ' ');
    return `Mari kita ${verb}. ${understanding.knowledgeGap ?? ''}`.trim();
  }

  private suggestPractice(
    understanding: ReturnType<QuestionUnderstandingService['understand']>,
    strategy: AdaptiveTutoringStrategy,
  ): string | undefined {
    if (strategy.strategy === 'PRACTICE' && understanding.conceptIds.length > 0) {
      return `Coba latihan untuk: ${understanding.conceptIds.join(', ')}`;
    }
    return undefined;
  }

  private computeStopReason(
    understanding: ReturnType<QuestionUnderstandingService['understand']>,
  ): TutorResponse['stopReason'] {
    if (understanding.conceptIds.length === 0) return 'CLARIFICATION_NEEDED';
    if (understanding.ambiguity > 0.6) return 'HIGH_AMBIGUITY';
    return 'OK';
  }

  private async loadOrBuildPolicy(userId: string): Promise<PersonalPolicy> {
    const stored = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!stored) {
      return this.personalPolicyService.buildEmpty(userId);
    }
    return this.personalPolicyService.buildEmpty(userId);
  }

  private async persistPolicy(policy: PersonalPolicy): Promise<void> {
    this.logger.debug(
      `Policy v${policy.version} for user=${policy.userId} confidence=${policy.confidence.toFixed(3)} preferred=${policy.preferredStrategy ?? '-'}`,
    );
  }

  private async recordEpisode(args: {
    userId: string;
    sessionId?: string;
    traceId: string;
    understanding: ReturnType<QuestionUnderstandingService['understand']>;
    strategy: AdaptiveTutoringStrategy;
    responseText: string;
    latencyMs: number;
  }) {
    return this.prisma.episode.create({
      data: {
        userId: args.userId,
        taskType: 'tutor_message',
        inputPayload: args.understanding,
        strategy: args.strategy as never,
        retrievedMemory: {},
        retrievedChunks: {},
        promptVersion: 'tutor.v1',
        modelName: 'reducera-tutor-deterministic',
        response: args.responseText,
        latencyMs: args.latencyMs,
      },
    });
  }

  private async recordDecisionTrace(args: {
    traceId: string;
    userId: string;
    sessionId?: string;
    taskId: string;
    understanding: ReturnType<QuestionUnderstandingService['understand']>;
    strategy: AdaptiveTutoringStrategy;
    responseText: string;
    latencyMs: number;
  }) {
    await this.prisma.decisionTrace.create({
      data: {
        traceId: args.traceId,
        userId: args.userId,
        sessionId: args.sessionId ?? null,
        taskId: args.taskId,
        agentVersion: 'tutor.v1',
        promptVersion: 'tutor.v1',
        policyVersion: '1.0.0',
        modelName: 'reducera-tutor-deterministic',
        strategyJson: args.strategy as never,
        retrievedMemory: {},
        retrievedChunks: {},
        responseText: args.responseText,
        latencyMs: args.latencyMs,
      },
    });
  }
}
