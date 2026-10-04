import { MasteryService } from '../mastery.service';

describe('MasteryService.updateScore (deterministic EMA)', () => {
  let service: MasteryService;

  beforeEach(() => {
    const repo = {
      upsert: jest.fn().mockImplementation(async (input: any) => ({ id: 'm1', ...input })),
      findByUserAndTopic: jest.fn(),
      listByUser: jest.fn(),
    };
    service = new MasteryService(repo as any);
  });

  it('first attempt initializes score to attempt score', () => {
    const next = service.computeNextScore({
      previousScore: null,
      previousAttempts: 0,
      attemptScore: 0.8,
      alpha: 0.3,
    });
    expect(next).toBeCloseTo(0.8);
  });

  it('second attempt blends: 0.3 * new + 0.7 * previous', () => {
    const next = service.computeNextScore({
      previousScore: 0.5,
      previousAttempts: 1,
      attemptScore: 0.9,
      alpha: 0.3,
    });
    expect(next).toBeCloseTo(0.3 * 0.9 + 0.7 * 0.5);
  });

  it('clamps to [0, 1]', () => {
    expect(
      service.computeNextScore({
        previousScore: null,
        previousAttempts: 0,
        attemptScore: 1.5,
        alpha: 0.3,
      }),
    ).toBe(1);
    expect(
      service.computeNextScore({
        previousScore: null,
        previousAttempts: 0,
        attemptScore: -0.2,
        alpha: 0.3,
      }),
    ).toBe(0);
  });

  it('updates persistence on updateFromAttempt', async () => {
    const repo = {
      findByUserAndTopic: jest.fn().mockResolvedValue({ score: 0.5, evidenceCount: 1 }),
      upsert: jest.fn().mockImplementation(async (input: any) => ({ id: 'm1', ...input })),
      listByUser: jest.fn(),
    };
    const svc = new MasteryService(repo as any);
    const result = await svc.updateFromAttempt('u-1', 't-1', 0.9);
    expect(result.score).toBeCloseTo(0.3 * 0.9 + 0.7 * 0.5);
    expect(repo.upsert).toHaveBeenCalled();
  });
});