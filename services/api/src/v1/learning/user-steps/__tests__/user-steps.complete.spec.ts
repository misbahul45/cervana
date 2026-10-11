import { AppError, AppErrorCode } from '@/common/lib/error';
import { UserStepsRepo } from '../user-steps.repo';
import { UserStepsService } from '../user-steps.service';
import { UpdateUserStepDto } from '../user-steps.dto';

type StepRow = {
  id: string;
  userId: string;
  stepTemplateId: string;
  order: number;
  isDone: boolean;
  isUnlocked: boolean;
};

function createFakePrisma() {
  const steps = new Map<string, StepRow>([
    ['us-1', { id: 'us-1', userId: 'u-1', stepTemplateId: 'st-1', order: 1, isDone: false, isUnlocked: true }],
    ['us-2', { id: 'us-2', userId: 'u-1', stepTemplateId: 'st-1', order: 2, isDone: false, isUnlocked: false }],
  ]);
  const scores = new Map<string, number>();

  const matches = (row: StepRow, where: Partial<StepRow>) =>
    Object.entries(where).every(([key, value]) => row[key as keyof StepRow] === value);

  const tx = {
    userStep: {
      updateMany: jest.fn(async ({ where, data }: { where: Partial<StepRow>; data: Partial<StepRow> }) => {
        const rows = [...steps.values()].filter((row) => matches(row, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => steps.get(where.id) ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = steps.get(where.id);
        if (!row) throw new Error('not found');
        return row;
      }),
    },
    step: {
      findUnique: jest.fn(async () => ({ lesson: { subTopic: { id: 'sub-1', topic: { id: 'top-1' } } } })),
    },
    leaderboardScore: {
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { id: string };
          create: { score: number };
          update: { score: { increment: number } };
        }) => {
          const current = scores.get(where.id);
          scores.set(where.id, current === undefined ? create.score : current + update.score.increment);
        },
      ),
    },
  };

  const prisma = { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) };

  return { prisma, steps, scores, tx };
}

describe('UserStepsRepo.complete', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let repo: UserStepsRepo;

  beforeEach(() => {
    fake = createFakePrisma();
    repo = new UserStepsRepo(fake.prisma as any);
  });

  it('marks the step done and unlocks the next one, and awards no points: points come from graded learning evidence', async () => {
    const result = await repo.complete('us-1');

    expect(result.isDone).toBe(true);
    expect(fake.steps.get('us-2')?.isUnlocked).toBe(true);
    expect(fake.tx.leaderboardScore.upsert).not.toHaveBeenCalled();
    expect(fake.scores.size).toBe(0);
  });

  it('rejects a repeated completion with 409', async () => {
    await repo.complete('us-1');

    const repeated = repo.complete('us-1');

    await expect(repeated).rejects.toMatchObject({
      statusCode: 409,
      code: AppErrorCode.INVALID_STATE_TRANSITION,
    });
    await expect(repeated).rejects.toBeInstanceOf(AppError);
    expect(fake.scores.size).toBe(0);
  });

  it('completes a step that has no template', async () => {
    fake.steps.set('us-custom', {
      id: 'us-custom',
      userId: 'u-1',
      stepTemplateId: null as unknown as string,
      order: 1,
      isDone: false,
      isUnlocked: true,
    });

    const result = await repo.complete('us-custom');

    expect(result.isDone).toBe(true);
    expect(fake.scores.size).toBe(0);
  });

  it('rejects an unknown step with 404 and awards nothing', async () => {
    await expect(repo.complete('missing')).rejects.toMatchObject({
      statusCode: 404,
      code: AppErrorCode.NOT_FOUND,
    });
    expect(fake.scores.size).toBe(0);
  });

  it('lets exactly one of two simultaneous completions succeed', async () => {
    const outcomes = await Promise.allSettled([repo.complete('us-1'), repo.complete('us-1')]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect(fake.scores.size).toBe(0);
  });
});

describe('UserStepsService.complete', () => {
  const completedRow = { id: 'us-1', userId: 'u-1', isDone: true };

  it('records one LESSON_COMPLETED event for a successful completion', async () => {
    const repo = { complete: jest.fn().mockResolvedValue(completedRow), findOne: jest.fn().mockResolvedValue(completedRow) };
    const events = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new UserStepsService(repo as any, events as any);

    await service.complete('us-1');

    expect(events.record).toHaveBeenCalledTimes(1);
    expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-1', action: 'LESSON_COMPLETED' }));
  });

  it('records no event when the completion is rejected as a repeat', async () => {
    const rejection = new AppError('User step already completed', 409, AppErrorCode.INVALID_STATE_TRANSITION);
    const repo = { complete: jest.fn().mockRejectedValue(rejection), findOne: jest.fn() };
    const events = { record: jest.fn() };
    const service = new UserStepsService(repo as any, events as any);

    await expect(service.complete('us-1')).rejects.toBe(rejection);
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('UpdateUserStepDto', () => {
  it('drops progress fields that only the server may change', () => {
    const parsed = UpdateUserStepDto.parse({ title: 'Langkah baru', isDone: false, isUnlocked: true });

    expect(parsed).toEqual({ title: 'Langkah baru' });
  });
});
