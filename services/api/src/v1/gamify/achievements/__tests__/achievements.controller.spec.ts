import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { STUDENT_A, STUDENT_B, asUser, createHttpApp } from '@/test-utils/http-harness';
import { AchievementEvaluator } from '../achievement-evaluator';
import { AchievementsController } from '../achievements.controller';

describe('AchievementsController', () => {
  let app: INestApplication;
  let evaluator: { progressFor: jest.Mock };
  const prisma = { marker: 'prisma' };

  beforeEach(async () => {
    evaluator = {
      progressFor: jest.fn(async () => [
        { code: 'a', title: 'A', description: null, iconName: 'badge', unlocked: true, unlockedAt: new Date('2026-10-09T10:00:00Z'), progress: { value: 1, target: 1 } },
        { code: 'b', title: 'B', description: null, iconName: 'star', unlocked: false, unlockedAt: null, progress: { value: 2, target: 5 } },
      ]),
    };
    app = await createHttpApp({
      controllers: [AchievementsController],
      providers: [
        { provide: AchievementEvaluator, useValue: evaluator },
        { provide: PrismaService, useValue: prisma },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/achievements/me').expect(401);
  });

  it("lists the caller's achievements with the counts and never reads another learner", async () => {
    const res = await request(app.getHttpServer()).get(`/achievements/me?userId=${STUDENT_B.id}`).set(asUser(STUDENT_A)).expect(200);

    expect(evaluator.progressFor).toHaveBeenCalledWith(STUDENT_A.id, prisma);
    expect(res.body.data).toMatchObject({ unlocked: 1, total: 2 });
    expect(res.body.data.achievements.map((a: { code: string }) => a.code)).toEqual(['a', 'b']);
  });
});
