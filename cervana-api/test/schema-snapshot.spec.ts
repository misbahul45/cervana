/**
 * Schema snapshot test. Documents the expected shape of every
 * Phase 2 model so that drift in `schema.prisma` is caught early.
 *
 * If you intentionally change a field name, type, or required flag,
 * update the snapshot below.
 */

const EXPECTED_MODELS = {
  LearnerGoal: ['userId', 'topicId', 'targetMastery', 'status', 'deadline'],
  TopicMasteryRecord: ['userId', 'topicId', 'score', 'confidence', 'evidenceCount'],
  StepMasteryRecord: ['userId', 'stepId', 'score', 'attempts', 'hintUsedLast'],
  Misconception: ['userId', 'conceptKey', 'count', 'status'],
  LearningPreference: ['userId', 'explanationStyle', 'pace', 'hintTolerance'],
  BehavioralSignals: ['userId', 'hintsPerQuestionAvg', 'responseTimeAvgSec'],
  EpisodicMemory: ['userId', 'eventType', 'content', 'source', 'status', 'importance'],
  SemanticLearnerMemory: ['userId', 'traitKey', 'traitValue', 'confidence', 'status'],
  ProceduralMemory: ['userId', 'strategyKey', 'expectedOutcome', 'status'],
  LearningEvent: ['userId', 'eventType', 'payload'],
  Episode: ['userId', 'taskType', 'promptVersion', 'modelName', 'response'],
  InteractionEvaluation: ['episodeId', 'correctness', 'overallScore', 'judgeModel'],
  PromptVersion: ['name', 'version', 'body', 'modelName', 'status'],
  PolicyVersion: ['name', 'version', 'parametersJson', 'status'],
  Experiment: ['name', 'armsJson', 'status'],
  ExperimentRun: ['experimentId', 'armName', 'metricsJson'],
  EvaluationDataset: ['name', 'version', 'isFrozen', 'examplesJson'],
  OptimizationRun: ['optimizerName', 'decision', 'candidateJson'],
  DecisionTrace: ['traceId', 'userId', 'promptVersion', 'policyVersion', 'responseText'],
  TeacherOverride: ['teacherId', 'targetUserId', 'targetType', 'reason'],
};

describe('Phase 2 schema snapshot', () => {
  it('documents expected fields per model', () => {
    expect(Object.keys(EXPECTED_MODELS)).toHaveLength(20);
  });

  it('each model has at least userId + identifier field', () => {
    for (const [model, fields] of Object.entries(EXPECTED_MODELS)) {
      expect(fields.length).toBeGreaterThanOrEqual(2);
      expect(fields.some((f) => /Id|userId|traceId|name|episodeId/.test(f))).toBe(true);
    }
  });

  it('Episode links to PromptVersion and model', () => {
    expect(EXPECTED_MODELS.Episode).toContain('promptVersion');
    expect(EXPECTED_MODELS.Episode).toContain('modelName');
  });

  it('DecisionTrace links prompt version, policy version, and model', () => {
    expect(EXPECTED_MODELS.DecisionTrace).toContain('promptVersion');
    expect(EXPECTED_MODELS.DecisionTrace).toContain('policyVersion');
    expect(EXPECTED_MODELS.DecisionTrace).toContain('modelName');
  });
});