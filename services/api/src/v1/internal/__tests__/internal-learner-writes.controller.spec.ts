import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { InternalLearnerWritesController } from '../internal-learner-writes.controller';
import { ChatMessagesService } from '../../chat/chat-messages/chat-messages.service';
import { ContentsService } from '../../chat/contents/contents.service';
import { PersonalityQuizzesService } from '../../learning/personality-quizzes/personality-quizzes.service';
import { ChatMessagesSseService } from '../../sse/chat-messages-sse/chat-messages-sse.service';
import { ContentSseService } from '../../sse/content-sse/content-sse.service';
import { PersonalityQuizSseService } from '../../sse/personality-quiz-sse/personality-quiz-sse.service';
import { InternalServiceGuard } from '@/common/authz/internal-service.guard';
import { ActingUserGuard } from '@/common/authz/acting-user.guard';
import { IdempotencyService } from '@/common/idempotency/idempotency.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createHttpApp } from '@/test-utils/http-harness';
import { internalAuthProviders, signInternalRequest } from '@/test-utils/internal-signing';

const CHAT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MESSAGE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LESSON = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STUDENT_A_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const STUDENT_B_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ADMIN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('InternalLearnerWritesController', () => {
  let app: INestApplication;
  let chatMessages: { update: jest.Mock };
  let contents: { create: jest.Mock };
  let quizzes: { create: jest.Mock };
  let chatMessagesSse: { emitUpdate: jest.Mock };
  let contentSse: { emitUpdate: jest.Mock };
  let quizSse: { emitUpdate: jest.Mock };
  let storedKeys: Map<string, Record<string, unknown>>;

  const users: Record<string, { id: string; role: string; isActive: boolean }> = {
    [STUDENT_A_ID]: { id: STUDENT_A_ID, role: 'STUDENT', isActive: true },
    [STUDENT_B_ID]: { id: STUDENT_B_ID, role: 'STUDENT', isActive: true },
    [ADMIN_ID]: { id: ADMIN_ID, role: 'ADMIN', isActive: true },
  };

  const send = (
    method: 'POST' | 'PATCH',
    target: string,
    body: object,
    options: { actingUser?: string; idempotencyKey?: string } = {},
  ) => {
    const raw = JSON.stringify(body);
    const headers = signInternalRequest({ method, target, body: raw, ...options });
    const call = method === 'POST' ? request(app.getHttpServer()).post(target) : request(app.getHttpServer()).patch(target);
    return call.set(headers).set('content-type', 'application/json').send(raw);
  };

  beforeEach(async () => {
    storedKeys = new Map();
    const prisma = {
      user: { findUnique: jest.fn(async ({ where }) => users[where.id] ?? null) },
      chat: {
        findUnique: jest.fn(async ({ where }) => (where.id === CHAT_A ? { userStep: { userId: STUDENT_A_ID } } : null)),
      },
      chatMessage: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === MESSAGE_A ? { chat: { userStep: { userId: STUDENT_A_ID } } } : null,
        ),
      },
      idempotencyKey: {
        findUnique: jest.fn(async ({ where }) => storedKeys.get(`${where.key_userId.key}:${where.key_userId.userId}`) ?? null),
        create: jest.fn(async ({ data }) => {
          storedKeys.set(`${data.key}:${data.userId}`, data);
          return data;
        }),
        delete: jest.fn(async ({ where }) => storedKeys.delete(`${where.key_userId.key}:${where.key_userId.userId}`)),
      },
    };
    chatMessages = { update: jest.fn().mockResolvedValue({ message: 'ok', data: { id: MESSAGE_A, chatId: CHAT_A } }) };
    contents = { create: jest.fn().mockResolvedValue({ message: 'ok', data: { id: 'content-1', chatId: CHAT_A } }) };
    quizzes = { create: jest.fn().mockResolvedValue({ message: 'ok', data: { id: 'quiz-1' } }) };
    chatMessagesSse = { emitUpdate: jest.fn() };
    contentSse = { emitUpdate: jest.fn() };
    quizSse = { emitUpdate: jest.fn() };

    app = await createHttpApp({
      controllers: [InternalLearnerWritesController],
      rawBody: true,
      withOwnershipGuard: true,
      providers: [
        InternalServiceGuard,
        ActingUserGuard,
        IdempotencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatMessagesService, useValue: chatMessages },
        { provide: ContentsService, useValue: contents },
        { provide: PersonalityQuizzesService, useValue: quizzes },
        { provide: ChatMessagesSseService, useValue: chatMessagesSse },
        { provide: ContentSseService, useValue: contentSse },
        { provide: PersonalityQuizSseService, useValue: quizSse },
        ...internalAuthProviders(),
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PATCH /internal/chat-messages/:id', () => {
    const target = `/internal/chat-messages/${MESSAGE_A}`;
    const body = { text: 'Mengambil data pelajaran', status: 'PROCESSING' };

    it('updates the message of the acting user and announces the change', async () => {
      await send('PATCH', target, body, { actingUser: STUDENT_A_ID }).expect(200);

      expect(chatMessages.update).toHaveBeenCalledWith(MESSAGE_A, body);
      expect(chatMessagesSse.emitUpdate).toHaveBeenCalledWith(CHAT_A);
    });

    it('rejects another user, an admin acting user and an unknown message', async () => {
      await send('PATCH', target, body, { actingUser: STUDENT_B_ID }).expect(403);
      await send('PATCH', target, body, { actingUser: ADMIN_ID }).expect(403);
      await send('PATCH', `/internal/chat-messages/${LESSON}`, body, { actingUser: STUDENT_A_ID }).expect(403);
      expect(chatMessages.update).not.toHaveBeenCalled();
    });

    it('rejects a field the contract does not define', async () => {
      await send('PATCH', target, { ...body, role: 'ASSISTANT' }, { actingUser: STUDENT_A_ID }).expect(400);
      expect(chatMessages.update).not.toHaveBeenCalled();
    });

    it('answers 400 without an acting user and 401 without service credentials', async () => {
      await send('PATCH', target, body).expect(400);
      await request(app.getHttpServer()).patch(target).send(body).expect(401);
    });

    it('applies the same key once and replays the first response', async () => {
      const options = { actingUser: STUDENT_A_ID, idempotencyKey: 'retry-key-0001' };

      const first = await send('PATCH', target, body, options).expect(200);
      const second = await send('PATCH', target, body, options).expect(200);

      expect(chatMessages.update).toHaveBeenCalledTimes(1);
      expect(chatMessagesSse.emitUpdate).toHaveBeenCalledTimes(1);
      expect(second.body).toEqual(first.body);
    });

    it('rejects the same key with a different body', async () => {
      const options = { actingUser: STUDENT_A_ID, idempotencyKey: 'retry-key-0002' };
      await send('PATCH', target, body, options).expect(200);

      await send('PATCH', target, { ...body, text: 'Teks lain' }, options).expect(400);

      expect(chatMessages.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /internal/contents', () => {
    const target = '/internal/contents';
    const body = {
      chatId: CHAT_A,
      chatMessageId: MESSAGE_A,
      data: '## Materi',
      citations: [{ lessonId: LESSON, chunkId: '3', score: 0.8, source: 'material' }],
      metadata: {},
    };

    it('stores content for a chat of the acting user, keeps object citations and announces it', async () => {
      await send('POST', target, body, { actingUser: STUDENT_A_ID }).expect(201);

      expect(contents.create).toHaveBeenCalledWith(body);
      expect(contentSse.emitUpdate).toHaveBeenCalledWith(CHAT_A);
    });

    it('rejects another user and an admin acting user', async () => {
      await send('POST', target, body, { actingUser: STUDENT_B_ID }).expect(403);
      await send('POST', target, body, { actingUser: ADMIN_ID }).expect(403);
      expect(contents.create).not.toHaveBeenCalled();
    });

    it('rejects a field the contract does not define', async () => {
      await send('POST', target, { ...body, jobStatus: 'DONE' }, { actingUser: STUDENT_A_ID }).expect(400);
      expect(contents.create).not.toHaveBeenCalled();
    });

    it('writes once when the same request is retried', async () => {
      const options = { actingUser: STUDENT_A_ID, idempotencyKey: 'retry-key-0003' };

      await send('POST', target, body, options).expect(201);
      await send('POST', target, body, options).expect(201);

      expect(contents.create).toHaveBeenCalledTimes(1);
      expect(contentSse.emitUpdate).toHaveBeenCalledTimes(1);
    });

    it('answers 400 without an acting user and 401 without service credentials', async () => {
      await send('POST', target, body).expect(400);
      await request(app.getHttpServer()).post(target).send(body).expect(401);
    });
  });

  describe('POST /internal/personality-quizzes', () => {
    const target = '/internal/personality-quizzes';
    const quiz = (userId?: string) => ({
      ...(userId ? { userId } : {}),
      lessonId: LESSON,
      title: 'AI Generated Personality Quiz',
      questions: [{ question: 'Saya suka bekerja sama', type: 'multiple_choice', difficulty: 'easy', options: ['Ya', 'Tidak'] }],
      userAttempt: 'JSON_NULL',
      result: 'JSON_NULL',
      takenAt: null,
    });

    it('creates the quiz for the acting user and announces it', async () => {
      await send('POST', target, quiz(STUDENT_A_ID), { actingUser: STUDENT_A_ID }).expect(201);

      expect(quizzes.create).toHaveBeenCalledWith(expect.objectContaining({ userId: STUDENT_A_ID, lessonId: LESSON }));
      expect(quizSse.emitUpdate).toHaveBeenCalledWith({ userId: STUDENT_A_ID, personalityQuizId: 'quiz-1' });
    });

    it('fills in the acting user when the body names none', async () => {
      await send('POST', target, quiz(), { actingUser: STUDENT_A_ID }).expect(201);

      expect(quizzes.create).toHaveBeenCalledWith(expect.objectContaining({ userId: STUDENT_A_ID }));
    });

    it('rejects a body that names another user, also for an admin acting user', async () => {
      await send('POST', target, quiz(STUDENT_A_ID), { actingUser: STUDENT_B_ID }).expect(403);
      await send('POST', target, quiz(STUDENT_A_ID), { actingUser: ADMIN_ID }).expect(403);
      expect(quizzes.create).not.toHaveBeenCalled();
    });

    it('answers 400 without an acting user and 401 without service credentials', async () => {
      await send('POST', target, quiz(STUDENT_A_ID)).expect(400);
      await request(app.getHttpServer()).post(target).send(quiz(STUDENT_A_ID)).expect(401);
    });
  });
});
