import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { LeaderboardsController } from '../leaderboards.controller';
import { LeaderboardsService } from '../leaderboards.service';

describe('Leaderboard cohort scoping (Phase 3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LeaderboardsController],
      providers: [
        {
          provide: LeaderboardsService,
          useValue: {
            findAll: jest.fn().mockImplementation(async (filter: any) => {
              if (filter.cohortId === 'A') return { data: [{ userId: 'u1', score: 100 }] };
              if (filter.cohortId === 'B') return { data: [{ userId: 'u2', score: 200 }] };
              return { data: [] };
            }),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns cohort A scores for cohort=A', async () => {
    const res = await request(app.getHttpServer()).get('/leaderboards?cohortId=A');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ userId: 'u1', score: 100 }] });
  });

  it('returns cohort B scores for cohort=B', async () => {
    const res = await request(app.getHttpServer()).get('/leaderboards?cohortId=B');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ userId: 'u2', score: 200 }] });
  });

  it('rejects request without cohortId with 400', async () => {
    const res = await request(app.getHttpServer()).get('/leaderboards');
    expect(res.status).toBe(400);
  });
});