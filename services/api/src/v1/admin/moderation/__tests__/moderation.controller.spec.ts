import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ModerationController } from '../moderation.controller';
import { ModerationService } from '../moderation.service';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { AdminReviewerGuard } from '@/v1/common/guards/admin-reviewer.guard';
import { AppExceptionsFilter } from '@/common/exceptions/app.exceptions';
import { ZodExceptionFilter } from '@/common/exceptions/zod.exception';

describe('ModerationController (Phase 4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ModerationController],
      providers: [
        {
          provide: ModerationService,
          useValue: {
            listPending: jest.fn().mockResolvedValue({
              articles: [{ id: 'a1', title: 'Test' }],
              classes: [],
            }),
            approve: jest.fn().mockImplementation((kind: string) =>
              Promise.resolve({ status: 'PUBLISHED', kind }),
            ),
            reject: jest.fn().mockImplementation((kind: string) =>
              Promise.resolve({ status: 'REJECTED', kind }),
            ),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminReviewerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new AppExceptionsFilter(), new ZodExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /pending returns queued items', async () => {
    const res = await request(app.getHttpServer()).get('/v1/admin/moderation/pending');
    expect(res.status).toBe(200);
    expect(res.body.articles[0].id).toBe('a1');
  });

  it('POST /articles/:id/approve moves status to PUBLISHED', async () => {
    const res = await request(app.getHttpServer()).post('/v1/admin/moderation/articles/a1/approve');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.kind).toBe('article');
  });

  it('POST /classes/:id/reject moves status to REJECTED', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/moderation/classes/c1/reject')
      .send({ feedback: 'needs work' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.kind).toBe('class');
  });
});