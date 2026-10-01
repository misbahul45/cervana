import { z } from 'zod';
import {
  CognitiveDemandSchema,
  MisconceptionHypothesisSchema,
} from '../question-intelligence/question-understanding.service';

export const QuestionBlueprintSchema = z.object({
  objective: z.string().min(1),
  conceptKey: z.string().min(1),
  prerequisiteKeys: z.array(z.string()).default([]),
  cognitiveDemand: CognitiveDemandSchema,
  misconceptionHypotheses: z.array(MisconceptionHypothesisSchema).default([]),
  difficulty: z.number().min(0).max(1),
  intendedReasoning: z.string().min(1),
  answerShape: z.enum(['mcq', 'short', 'long', 'sandbox', 'fill', 'match', 'bool']),
  validationRequirement: z.enum(['exact', 'rubric', 'numeric', 'symbolic']),
  pedagogicalPurpose: z.string().min(1),
});

export type QuestionBlueprint = z.infer<typeof QuestionBlueprintSchema>;

export type ValidationOutcome = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface GeneratedQuestion {
  text: string;
  answer: string;
  rationale: string;
  blueprint: QuestionBlueprint;
}

export interface ValidatorVerdict {
  outcome: ValidationOutcome;
  reason: string;
  route?: 'review' | 'clarification' | 'rejection' | 'fallback';
}

export class QuestionBlueprintService {
  validate(blueprint: QuestionBlueprint): ValidatorVerdict[] {
    const issues: ValidatorVerdict[] = [];

    if (blueprint.difficulty < 0 || blueprint.difficulty > 1) {
      issues.push({ outcome: 'FAIL', reason: 'difficulty out of [0,1]', route: 'rejection' });
    }

    if (!blueprint.intendedReasoning.trim()) {
      issues.push({ outcome: 'FAIL', reason: 'intendedReasoning empty', route: 'rejection' });
    }

    if (!blueprint.pedagogicalPurpose.trim()) {
      issues.push({ outcome: 'FAIL', reason: 'pedagogicalPurpose empty', route: 'rejection' });
    }

    const knownDemands = new Set(CognitiveDemandSchema.options);
    if (!knownDemands.has(blueprint.cognitiveDemand)) {
      issues.push({ outcome: 'FAIL', reason: 'unknown cognitiveDemand', route: 'rejection' });
    }

    if (blueprint.answerShape === 'mcq' && blueprint.validationRequirement !== 'exact') {
      issues.push({
        outcome: 'FAIL',
        reason: 'mcq requires exact validation',
        route: 'review',
      });
    }

    if (
      blueprint.answerShape === 'long' &&
      !['rubric', 'numeric', 'symbolic'].includes(blueprint.validationRequirement)
    ) {
      issues.push({
        outcome: 'UNKNOWN',
        reason: 'long answer requires rubric validation',
        route: 'review',
      });
    }

    return issues;
  }

  isPass(verdicts: ValidatorVerdict[]): boolean {
    return verdicts.every((v) => v.outcome !== 'FAIL');
  }
}

export class ThreeValuedValidatorService {
  /**
   * Generator -> Validator gate (master prompt §29).
   * Independent from the LLM; deterministic checks.
   */
  gateQuestion(args: {
    blueprint: QuestionBlueprint;
    answer: string;
    rationale: string;
    sourceAlignment: boolean;
    answerConsistent: boolean;
    schemaOk: boolean;
  }): ValidatorVerdict {
    const blueprintService = new QuestionBlueprintService();
    const blueprintIssues = blueprintService.validate(args.blueprint);

    if (blueprintIssues.some((i) => i.outcome === 'FAIL')) {
      return { outcome: 'FAIL', reason: 'blueprint invalid', route: 'rejection' };
    }
    if (blueprintIssues.some((i) => i.outcome === 'UNKNOWN')) {
      return { outcome: 'UNKNOWN', reason: 'blueprint needs review', route: 'review' };
    }

    if (!args.schemaOk) {
      return { outcome: 'FAIL', reason: 'schema mismatch', route: 'rejection' };
    }
    if (!args.answerConsistent) {
      return { outcome: 'FAIL', reason: 'answer inconsistent with blueprint', route: 'rejection' };
    }
    if (!args.sourceAlignment) {
      return { outcome: 'UNKNOWN', reason: 'source alignment uncertain', route: 'review' };
    }
    if (!args.rationale.trim()) {
      return { outcome: 'UNKNOWN', reason: 'rationale missing', route: 'clarification' };
    }

    return { outcome: 'PASS', reason: 'all checks satisfied' };
  }
}
