import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { TenantContextService } from '@/common/tenancy/tenant-context.service';
import {
  ADMIN_A,
  STUDENT_A,
  TEACHER_A,
  TEACHER_B,
  asUser,
  createHttpApp,
} from '@/test-utils/http-harness';
import { CreateArticleDto } from '../articles.dto';
import { AdminArticlesController } from '../admin-articles.controller';
import { ArticleAuthoringService } from '../article-authoring.service';
import { ArticleModerationService } from '../article-moderation.service';
import { ArticlesController } from '../articles.controller';
import { MarketplaceArticlesController } from '../marketplace-articles.controller';
import { MarketplaceArticlesService } from '../marketplace-articles.service';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ARTICLE = '11111111-1111-4111-8111-111111111111';

const VALID = { title: 'Jurnal penyesuaian', content: '# Isi', accessType: 'FREE' };

describe('Articles HTTP contract', () => {
  let app: INestApplication;
  let authoring: Record<'create' | 'list' | 'findOne' | 'update' | 'submitReview' | 'withdraw' | 'archive', jest.Mock>;
  let moderation: Record<'queue' | 'findOne' | 'approve' | 'reject' | 'suspend' | 'reinstate' | 'archive', jest.Mock>;
  let marketplace: Record<'list' | 'findOne' | 'access' | 'content', jest.Mock>;
  let memberships: Record<string, Array<{ tenantId: string; role: string }>>;

  beforeEach(async () => {
    const ok = () => jest.fn().mockResolvedValue({ message: 'ok', data: {} });
    authoring = { create: ok(), list: ok(), findOne: ok(), update: ok(), submitReview: ok(), withdraw: ok(), archive: ok() };
    moderation = { queue: ok(), findOne: ok(), approve: ok(), reject: ok(), suspend: ok(), reinstate: ok(), archive: ok() };
    marketplace = { list: ok(), findOne: ok(), access: ok(), content: ok() };
    memberships = {
      [TEACHER_A.id]: [{ tenantId: TENANT_A, role: 'TEACHER' }],
      [TEACHER_B.id]: [{ tenantId: TENANT_B, role: 'OWNER' }],
    };
    const prisma = {
      tenantMembership: { findMany: jest.fn().mockImplementation(async ({ where }) => memberships[where.userId] ?? []) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: TENANT_A }) },
    };

    app = await createHttpApp({
      controllers: [ArticlesController, MarketplaceArticlesController, AdminArticlesController],
      providers: [
        PolicyService,
        TenantContextService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: ArticleAuthoringService, useValue: authoring },
        { provide: ArticleModerationService, useValue: moderation },
        { provide: MarketplaceArticlesService, useValue: marketplace },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('authoring is for tenant members only', () => {
    it('requires a login', async () => {
      await http().post('/articles').send(VALID).expect(401);
      await http().get('/articles').expect(401);
    });

    it('is closed to learners and to teachers without a membership', async () => {
      await http().post('/articles').set(asUser(STUDENT_A)).send(VALID).expect(403);
      await http().get('/articles').set(asUser(STUDENT_A)).expect(403);
      memberships[TEACHER_A.id] = [];
      await http().post('/articles').set(asUser(TEACHER_A)).send(VALID).expect(403);
      expect(authoring.create).not.toHaveBeenCalled();
    });

    it('resolves the tenant from the membership, never from the client', async () => {
      await http().post('/articles').set({ ...asUser(TEACHER_A), 'x-trace-id': 'trace-1' }).send(VALID).expect(201);
      expect(authoring.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: TEACHER_A.id }),
        { userId: TEACHER_A.id, tenantId: TENANT_A, tenantRole: 'TEACHER', isPlatformAdmin: false },
        VALID,
        'trace-1',
      );
    });

    it('refuses a forged tenant header', async () => {
      await http().post('/articles').set({ ...asUser(TEACHER_A), 'x-tenant-id': TENANT_B }).send(VALID).expect(403);
      await http().post('/articles').set({ ...asUser(TEACHER_A), 'x-tenant-id': 'not-a-uuid' }).send(VALID).expect(400);
      await http().get(`/articles/${ARTICLE}`).set({ ...asUser(TEACHER_A), 'x-tenant-id': TENANT_B }).expect(403);
      expect(authoring.create).not.toHaveBeenCalled();
      expect(authoring.findOne).not.toHaveBeenCalled();
    });

    it('requires an explicit tenant when the teacher belongs to several', async () => {
      memberships[TEACHER_A.id] = [
        { tenantId: TENANT_A, role: 'TEACHER' },
        { tenantId: TENANT_B, role: 'EDITOR' },
      ];
      await http().post('/articles').set(asUser(TEACHER_A)).send(VALID).expect(400);
      await http().post('/articles').set({ ...asUser(TEACHER_A), 'x-tenant-id': TENANT_B }).send(VALID).expect(201);
      expect(authoring.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tenantId: TENANT_B, tenantRole: 'EDITOR' }), VALID, expect.any(String));
    });
  });

  describe('mass assignment', () => {
    it.each([
      ['status', { status: 'PUBLISHED' }],
      ['authorId', { authorId: 'someone-else' }],
      ['tenantId', { tenantId: TENANT_B }],
      ['publishedVersionId', { publishedVersionId: ARTICLE }],
      ['publishedAt', { publishedAt: '2026-01-01T00:00:00.000Z' }],
      ['reviewedById', { reviewedById: ADMIN_A.id }],
      ['reviewNote', { reviewNote: 'approved' }],
      ['currency', { currency: 'USD' }],
    ])('creating cannot set %s', async (_field, extra) => {
      await http().post('/articles').set(asUser(TEACHER_A)).send({ ...VALID, ...extra }).expect(400);
      expect(authoring.create).not.toHaveBeenCalled();
    });

    it.each([
      ['status', { status: 'PUBLISHED' }],
      ['authorId', { authorId: 'someone-else' }],
      ['submittedAt', { submittedAt: '2026-01-01T00:00:00.000Z' }],
    ])('updating cannot set %s', async (_field, extra) => {
      await http().patch(`/articles/${ARTICLE}`).set(asUser(TEACHER_A)).send(extra).expect(400);
      expect(authoring.update).not.toHaveBeenCalled();
    });

    it('a partial update does not smuggle in defaults', async () => {
      await http().patch(`/articles/${ARTICLE}`).set(asUser(TEACHER_A)).send({ title: 'Judul baru' }).expect(200);
      expect(authoring.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), ARTICLE, { title: 'Judul baru' }, expect.any(String));
    });

    it.each([
      ['a title that is too short', { title: 'ab' }],
      ['a negative price', { accessType: 'PAID', price: -5 }],
      ['a price with three decimals', { accessType: 'PAID', price: '10.123' }],
      ['an unknown access type', { accessType: 'SECRET' }],
      ['an insecure cover image', { coverImage: { url: 'http://x.test/a.png', fileId: 'images/a' } }],
      ['a script cover image', { coverImage: { url: 'javascript:alert(1)', fileId: 'images/a' } }],
      ['empty content', { content: '' }],
      ['a bad slug', { slug: 'Not A Slug' }],
    ])('rejects %s', async (_label, extra) => {
      await http().post('/articles').set(asUser(TEACHER_A)).send({ ...VALID, ...extra }).expect(400);
      expect(authoring.create).not.toHaveBeenCalled();
    });

    it('bounds the article body at the schema level', () => {
      expect(CreateArticleDto.safeParse({ ...VALID, content: 'x'.repeat(200000) }).success).toBe(true);
      expect(CreateArticleDto.safeParse({ ...VALID, content: 'x'.repeat(200001) }).success).toBe(false);
    });

    it('rejects a malformed article id', async () => {
      await http().get('/articles/not-a-uuid').set(asUser(TEACHER_A)).expect(400);
      await http().post('/articles/not-a-uuid/submit-review').set(asUser(TEACHER_A)).expect(400);
    });
  });

  describe('review commands are for administrators', () => {
    const commands: Array<[string, string, object]> = [
      ['get', '/admin/articles', {}],
      ['get', `/admin/articles/${ARTICLE}`, {}],
      ['post', `/admin/articles/${ARTICLE}/approve`, {}],
      ['post', `/admin/articles/${ARTICLE}/reject`, { reason: 'Needs more examples' }],
      ['post', `/admin/articles/${ARTICLE}/suspend`, { reason: 'Copyright complaint' }],
      ['post', `/admin/articles/${ARTICLE}/reinstate`, {}],
      ['post', `/admin/articles/${ARTICLE}/archive`, {}],
    ];
    const call = (method: string, path: string, body: object, actor?: object) => {
      let req = (http() as any)[method](path);
      if (actor) req = req.set(asUser(actor as never));
      return method === 'get' ? req : req.send(body);
    };

    it.each(commands)('%s %s requires a login', async (method, path, body) => {
      await call(method, path, body).expect(401);
    });

    it.each(commands)('%s %s is closed to learners and teachers', async (method, path, body) => {
      await call(method, path, body, STUDENT_A).expect(403);
      await call(method, path, body, TEACHER_A).expect(403);
      expect(Object.values(moderation).every((fn) => fn.mock.calls.length === 0)).toBe(true);
    });

    it('lets an administrator approve, with or without a note', async () => {
      await call('post', `/admin/articles/${ARTICLE}/approve`, {}, ADMIN_A).expect(201);
      await call('post', `/admin/articles/${ARTICLE}/approve`, { note: 'Great work' }, ADMIN_A).expect(201);
      expect(moderation.approve).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: ADMIN_A.id }), ARTICLE, undefined, expect.any(String));
      expect(moderation.approve).toHaveBeenNthCalledWith(2, expect.anything(), ARTICLE, 'Great work', expect.any(String));
    });

    it('requires a reason to reject or suspend', async () => {
      for (const command of ['reject', 'suspend']) {
        await call('post', `/admin/articles/${ARTICLE}/${command}`, {}, ADMIN_A).expect(400);
        await call('post', `/admin/articles/${ARTICLE}/${command}`, { reason: 'ok' }, ADMIN_A).expect(400);
        await call('post', `/admin/articles/${ARTICLE}/${command}`, { reason: 'valid reason', status: 'PUBLISHED' }, ADMIN_A).expect(400);
      }
      expect(moderation.reject).not.toHaveBeenCalled();
      expect(moderation.suspend).not.toHaveBeenCalled();
    });

    it('validates the queue filter', async () => {
      await call('get', '/admin/articles?status=PENDING_REVIEW&limit=10', {}, ADMIN_A).expect(200);
      expect(moderation.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'PENDING_REVIEW', limit: 10 }));
      await call('get', '/admin/articles?status=NOPE', {}, ADMIN_A).expect(400);
      await call('get', '/admin/articles?limit=500', {}, ADMIN_A).expect(400);
    });
  });

  describe('marketplace', () => {
    it('lists and shows metadata without a login', async () => {
      await http().get('/marketplace/articles').expect(200);
      await http().get(`/marketplace/articles/${ARTICLE}`).expect(200);
      expect(marketplace.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 12, sort: 'newest' }));
    });

    it('needs a login for access checks and content', async () => {
      await http().get(`/marketplace/articles/${ARTICLE}/access`).expect(401);
      await http().get(`/marketplace/articles/${ARTICLE}/content`).expect(401);
      await http().get(`/marketplace/articles/${ARTICLE}/content`).set(asUser(STUDENT_A)).expect(200);
      expect(marketplace.content).toHaveBeenCalledWith(expect.objectContaining({ id: STUDENT_A.id }), ARTICLE);
    });

    it('bounds the listing query', async () => {
      await http().get('/marketplace/articles?limit=500').expect(400);
      await http().get('/marketplace/articles?sort=drop-table').expect(400);
      await http().get('/marketplace/articles?categoryId=nope').expect(400);
      await http().get('/marketplace/articles?q=' + 'x'.repeat(101)).expect(400);
      await http().get('/marketplace/articles?page=0').expect(400);
    });
  });
});
