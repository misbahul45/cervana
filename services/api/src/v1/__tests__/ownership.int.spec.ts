import { Controller, Get, Param } from '@nestjs/common';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { OWNER_RESOLVERS } from '@/v1/common/guards/ownership.registry';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { STUDENT_A, STUDENT_B, asUser, createHttpApp } from '@/test-utils/http-harness';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

@Controller('probe')
class ProbeController {
  @Get(':id')
  @RequireOwnership('message')
  getMessage(@Param('id') id: string) {
    return { ok: true, id };
  }
}

describe('cross-user ownership (Phase 0)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prismaMock = {
      chatMessage: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => ({
          id: where.id,
          userId: where.id === 'msg-student-a' ? STUDENT_A.id : STUDENT_B.id,
        })),
      },
    };
    OWNER_RESOLVERS['message'] = async (pp: any, id: string) => {
      const r = await pp.chatMessage.findUnique({ where: { id } });
      return r?.userId === STUDENT_A.id ? STUDENT_A.id : STUDENT_B.id;
    };

    app = await createHttpApp({
      withOwnershipGuard: true,
      controllers: [ProbeController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejects cross-user access with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/msg-student-b')
      .set(asUser(STUDENT_A));
    expect(res.status).toBe(403);
  });

  it('allows the resource owner', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/msg-student-a')
      .set(asUser(STUDENT_A));
    expect(res.status).toBe(200);
  });
});