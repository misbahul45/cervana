import { UserStepsService } from '../user-steps.service';

describe('UserStepsService.placeDiagnostic (Phase 1)', () => {
  let service: UserStepsService;

  beforeEach(() => {
    service = new UserStepsService({} as any);
  });

  it('recommends Level 4 when most answers are A', () => {
    const result = service.placeDiagnostic(['A', 'A', 'A', 'A', 'B']);
    expect(result.recommendedLevel).toBe(4);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('recommends Level 1 when no answers are correct', () => {
    const result = service.placeDiagnostic(['B', 'B', 'B', 'B', 'B']);
    expect(result.recommendedLevel).toBe(1);
    expect(result.confidence).toBe(0);
  });

  it('falls back to Level 1 for empty answers', () => {
    const result = service.placeDiagnostic([]);
    expect(result.recommendedLevel).toBe(1);
    expect(result.confidence).toBe(0);
  });

  it('returns a non-empty recommendedTopicId', () => {
    const result = service.placeDiagnostic(['A', 'B', 'A', 'B', 'B']);
    expect(result.recommendedTopicId).toBeTruthy();
  });
});