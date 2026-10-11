import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { STUDENT_A, STUDENT_B, TEACHER_A, asUser, createHttpApp } from '@/test-utils/http-harness';
import { GamifyMeController } from '../gamify-me.controller';
import { GamifyMeService } from '../gamify-me.service';

describe('GamifyMeController', () => {
  let app: INestApplication;
  let me: { get: jest.Mock };

  beforeEach(async () => {
    me = { get: jest.fn(async (userId: string) => ({ xp: 10, owner: userId })) };
    app = await createHttpApp({ controllers: [GamifyMeController], providers: [{ provide: GamifyMeService, useValue: me }] });
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });

  it("returns the caller's own state and ignores a userId in the query", async () => {
    const res = await request(app.getHttpServer()).get(`/me?userId=${STUDENT_B.id}`).set(asUser(STUDENT_A)).expect(200);

    expect(me.get).toHaveBeenCalledWith(STUDENT_A.id);
    expect(me.get).not.toHaveBeenCalledWith(STUDENT_B.id);
    expect(JSON.stringify(res.body)).toContain('"xp":10');
  });

  it('is open to any signed in role as a learner of their own', async () => {
    await request(app.getHttpServer()).get('/me').set(asUser(TEACHER_A)).expect(200);

    expect(me.get).toHaveBeenCalledWith(TEACHER_A.id);
  });
});
