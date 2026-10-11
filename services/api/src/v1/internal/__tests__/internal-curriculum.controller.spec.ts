import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { InternalCurriculumController } from '../internal-curriculum.controller';
import { LessonsService } from '../../curriculum/lessons/lessons.service';
import { StepsService } from '../../curriculum/steps/steps.service';
import { InternalServiceGuard } from '@/common/authz/internal-service.guard';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { ADMIN_A, STUDENT_A, asUser, createHttpApp } from '@/test-utils/http-harness';
import { internalAuthProviders, signInternalRequest } from '@/test-utils/internal-signing';

describe('InternalCurriculumController', () => {
  let app: INestApplication;
  let lessons: { findOne: jest.Mock };
  let steps: { findOne: jest.Mock; findAll: jest.Mock };

  const signedGet = (target: string) =>
    request(app.getHttpServer()).get(target).set(signInternalRequest({ method: 'GET', target }));

  beforeEach(async () => {
    lessons = { findOne: jest.fn().mockResolvedValue({ message: 'ok', data: { id: 'l-1', title: 'Jurnal' } }) };
    steps = {
      findOne: jest.fn().mockResolvedValue({ message: 'ok', data: { id: 's-1' } }),
      findAll: jest.fn().mockResolvedValue({ message: 'ok', data: { data: [{ id: 's-1' }] } }),
    };
    app = await createHttpApp({
      controllers: [InternalCurriculumController],
      rawBody: true,
      withOwnershipGuard: true,
      providers: [
        InternalServiceGuard,
        { provide: PrismaService, useValue: {} },
        { provide: LessonsService, useValue: lessons },
        { provide: StepsService, useValue: steps },
        ...internalAuthProviders(),
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves a lesson to the signed service with the same data as the user-facing route', async () => {
    const response = await signedGet('/internal/lessons/l-1?include=steps').expect(200);

    expect(lessons.findOne).toHaveBeenCalledWith('l-1', { include: 'steps' });
    expect(response.body.data).toEqual({ id: 'l-1', title: 'Jurnal' });
  });

  it('serves the steps of a lesson with the filter and sort the caller sends', async () => {
    const target = '/internal/steps?lessonId=l-1&sort=sortOrder:asc';

    await signedGet(target).expect(200);

    expect(steps.findAll).toHaveBeenCalledWith({ lessonId: 'l-1', sort: 'sortOrder:asc' });
  });

  it('serves one step', async () => {
    await signedGet('/internal/steps/s-1').expect(200);

    expect(steps.findOne).toHaveBeenCalledWith('s-1', {});
  });

  it.each(['/internal/lessons/l-1', '/internal/steps', '/internal/steps/s-1'])(
    'rejects %s without service credentials',
    async (target) => {
      await request(app.getHttpServer()).get(target).expect(401);
    },
  );

  it.each([
    ['a student session', STUDENT_A],
    ['an admin session', ADMIN_A],
  ])('does not accept %s in place of the service identity', async (_label, user) => {
    await request(app.getHttpServer()).get('/internal/lessons/l-1').set(asUser(user)).expect(401);
    expect(lessons.findOne).not.toHaveBeenCalled();
  });
});
