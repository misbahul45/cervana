import { INestApplication } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import * as request from 'supertest';
import { CreatorEligibilityController } from '../creator-eligibility.controller';
import { CreatorEligibilityService } from '../creator-eligibility.service';
import { STUDENT_A, STUDENT_B, asUser, createHttpApp } from '@/test-utils/http-harness';

describe('CreatorEligibilityController', () => {
  let app: INestApplication;
  let eligibility: { check: jest.Mock };

  beforeEach(async () => {
    eligibility = { check: jest.fn().mockResolvedValue({ eligible: false, score: 0.4, passedConcepts: 0, totalConcepts: 2 }) };
    app = await createHttpApp({
      controllers: [CreatorEligibilityController],
      providers: [{ provide: CreatorEligibilityService, useValue: eligibility }],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('takes its prefix from the router module, so the controller adds none of its own', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CreatorEligibilityController)).toBe('/');
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/').expect(401);
  });

  it('checks the caller for the requested topic and ignores a userId in the query', async () => {
    const res = await request(app.getHttpServer()).get(`/?topicId=topic-1&userId=${STUDENT_B.id}`).set(asUser(STUDENT_A)).expect(200);

    expect(eligibility.check).toHaveBeenCalledWith({ userId: STUDENT_A.id, topicId: 'topic-1' });
    expect(JSON.stringify(res.body)).toContain('totalConcepts');
  });

  it('treats a missing topic id as an empty one', async () => {
    await request(app.getHttpServer()).get('/').set(asUser(STUDENT_A)).expect(200);

    expect(eligibility.check).toHaveBeenCalledWith({ userId: STUDENT_A.id, topicId: '' });
  });
});
