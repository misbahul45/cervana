import { Body, Controller, Get, INestApplication, Param, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { RedisService } from '@/common/config/redis/redis.service';
import { InternalServiceGuard } from '../internal-service.guard';
import { InternalActing, InternalOwnership } from '../internal-acting.decorator';
import { ActingUserGuard } from '../acting-user.guard';
import {
  ACTING_USER_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  computeSignature,
} from '../internal-signature';
import { ADMIN_A, STUDENT_A, asUser, createHttpApp } from '@/test-utils/http-harness';

const SECRET = 'unit-test-service-secret';

@Controller('internal/probe')
class ProbeController {
  @Get('open')
  @InternalActing()
  open(@Req() req: { user: unknown }) {
    return { actor: req.user };
  }

  @Get('chats/:id')
  @InternalActing()
  @InternalOwnership('chat')
  chat(@Param('id') id: string, @Req() req: { user: unknown }) {
    return { id, actor: req.user };
  }

  @Post('chats')
  @InternalActing()
  @InternalOwnership('chat', { field: 'chatId', source: 'body' })
  create(@Body() body: { chatId: string }, @Req() req: { user: unknown }) {
    return { chatId: body.chatId, actor: req.user };
  }
}

describe('ActingUserGuard on internal routes', () => {
  let app: INestApplication;
  let prisma: {
    user: { findUnique: jest.Mock };
    chat: { findUnique: jest.Mock };
  };
  const replayStore = new Set<string>();
  const fakeReplayRedis = {
    set: jest.fn(async (key: string) => {
      if (replayStore.has(key)) return null;
      replayStore.add(key);
      return 'OK';
    }),
  };

  const users: Record<string, { id: string; role: string; isActive: boolean }> = {
    'student-a': { id: 'student-a', role: 'STUDENT', isActive: true },
    'student-b': { id: 'student-b', role: 'STUDENT', isActive: true },
    'admin-a': { id: 'admin-a', role: 'ADMIN', isActive: true },
    'student-off': { id: 'student-off', role: 'STUDENT', isActive: false },
  };

  const signed = (options: { method: 'GET' | 'POST'; target: string; body?: string; actingUser?: string }) => {
    const timestamp = String(Date.now());
    const headers: Record<string, string> = {
      [SERVICE_ID_HEADER]: 'ai-api',
      [SERVICE_TIMESTAMP_HEADER]: timestamp,
      [SERVICE_SIGNATURE_HEADER]: computeSignature({
        secret: SECRET,
        timestamp,
        method: options.method,
        target: options.target,
        body: Buffer.from(options.body ?? ''),
        actingUserId: options.actingUser,
      }),
    };
    if (options.method !== 'GET') headers[IDEMPOTENCY_KEY_HEADER] = `key-${Math.random()}`;
    if (options.actingUser) headers[ACTING_USER_HEADER] = options.actingUser;
    return headers;
  };

  const get = (target: string, actingUser?: string) =>
    request(app.getHttpServer()).get(target).set(signed({ method: 'GET', target, actingUser }));

  const post = (target: string, body: object, actingUser?: string) => {
    const raw = JSON.stringify(body);
    return request(app.getHttpServer())
      .post(target)
      .set(signed({ method: 'POST', target, body: raw, actingUser }))
      .set('content-type', 'application/json')
      .send(raw);
  };

  beforeEach(async () => {
    replayStore.clear();
    prisma = {
      user: { findUnique: jest.fn(async ({ where }) => users[where.id] ?? null) },
      chat: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === 'chat-a' ? { userStep: { userId: 'student-a' } } : null,
        ),
      },
    };
    app = await createHttpApp({
      controllers: [ProbeController],
      rawBody: true,
      withOwnershipGuard: true,
      providers: [
        InternalServiceGuard,
        ActingUserGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'INTERNAL_AI_API_SECRET' ? SECRET : undefined) } },
        { provide: RedisService, useValue: { client: fakeReplayRedis } },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers 401 to an unsigned request before looking up any user', async () => {
    await request(app.getHttpServer()).get('/internal/probe/open').set(ACTING_USER_HEADER, 'student-a').expect(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('answers 401 when the acting user header is swapped after signing', async () => {
    const target = '/internal/probe/chats/chat-a';
    const headers = signed({ method: 'GET', target, actingUser: 'student-a' });

    await request(app.getHttpServer())
      .get(target)
      .set({ ...headers, [ACTING_USER_HEADER]: 'student-b' })
      .expect(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('answers 401 when an acting user header is added to a request signed without one', async () => {
    const target = '/internal/probe/open';
    const headers = signed({ method: 'GET', target });

    await request(app.getHttpServer())
      .get(target)
      .set({ ...headers, [ACTING_USER_HEADER]: 'student-a' })
      .expect(401);
  });

  it('does not accept a user session in place of the service identity', async () => {
    await request(app.getHttpServer()).get('/internal/probe/open').set(asUser(STUDENT_A)).expect(401);
    await request(app.getHttpServer()).get('/internal/probe/open').set(asUser(ADMIN_A)).expect(401);
  });

  it('answers 400 when the acting user header is missing', async () => {
    const response = await get('/internal/probe/open').expect(400);

    expect(response.body.code ?? response.body.message?.code ?? JSON.stringify(response.body)).toContain(
      'ACTING_USER_REQUIRED',
    );
  });

  it('answers 403 for an unknown acting user', async () => {
    await get('/internal/probe/open', 'nobody').expect(403);
  });

  it('answers 403 for an inactive acting user', async () => {
    await get('/internal/probe/open', 'student-off').expect(403);
  });

  it('exposes the acting user as the request user', async () => {
    const response = await get('/internal/probe/open', 'student-a').expect(200);

    expect(response.body.actor).toEqual({ id: 'student-a', role: 'STUDENT' });
  });

  it('allows the owner of the resource', async () => {
    await get('/internal/probe/chats/chat-a', 'student-a').expect(200);
  });

  it('rejects another user', async () => {
    await get('/internal/probe/chats/chat-a', 'student-b').expect(403);
  });

  it('rejects a resource that does not exist', async () => {
    await get('/internal/probe/chats/chat-missing', 'student-a').expect(403);
  });

  it('does not let an ADMIN acting user bypass ownership', async () => {
    await get('/internal/probe/chats/chat-a', 'admin-a').expect(403);
  });

  it('checks the parent resource named in the body', async () => {
    await post('/internal/probe/chats', { chatId: 'chat-a' }, 'student-a').expect(201);
    await post('/internal/probe/chats', { chatId: 'chat-a' }, 'student-b').expect(403);
  });
});
