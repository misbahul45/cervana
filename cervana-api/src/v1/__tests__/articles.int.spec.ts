import { Role, TenantRole } from '@prisma/client';
import { Pool } from 'pg';
import { TenantContext } from '@/common/tenancy/tenant-context';
import {
  createPool,
  databaseUrl,
  describeDb,
  insertMembership,
  insertTenant,
  insertUser,
} from '@/test-utils/pg-fixtures';
import { buildCommerceStack, CommerceStack } from '@/test-utils/commerce-harness';

const proofFor = (userId: string) => ({
  url: `https://res.cloudinary.com/demo/image/upload/images/${userId}-proof.png`,
  fileId: `images/${userId}-proof`,
});

describeDb('articles on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  let s: CommerceStack;

  const teacher = (id: string) => ({ id, role: Role.TEACHER });
  const admin = (id: string) => ({ id, role: Role.ADMIN });
  const student = (id: string) => ({ id, role: Role.STUDENT });
  const ctx = (userId: string, tenantId: string, tenantRole: TenantRole): TenantContext => ({
    userId,
    tenantId,
    tenantRole,
    isPlatformAdmin: false,
  });

  const one = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0];
  const count = async (sql: string, params: unknown[] = []) => Number((await one(sql, params)).count);

  const tenantWith = async () => {
    const owner = await insertUser(pool, 'TEACHER');
    const author = await insertUser(pool, 'TEACHER');
    const editor = await insertUser(pool, 'TEACHER');
    const tenant = await insertTenant(pool, owner);
    await insertMembership(pool, tenant, owner, 'OWNER');
    await insertMembership(pool, tenant, author, 'TEACHER');
    await insertMembership(pool, tenant, editor, 'EDITOR');
    const reviewer = await insertUser(pool, 'ADMIN');
    return {
      owner,
      author,
      editor,
      tenant,
      reviewer,
      ownerCtx: ctx(owner, tenant, TenantRole.OWNER),
      authorCtx: ctx(author, tenant, TenantRole.TEACHER),
      editorCtx: ctx(editor, tenant, TenantRole.EDITOR),
    };
  };

  const draft = (w: Awaited<ReturnType<typeof tenantWith>>, overrides: Record<string, unknown> = {}) =>
    s.articleAuthoring.create(
      teacher(w.author),
      w.authorCtx,
      { title: 'Jurnal penyesuaian', accessType: 'FREE', content: '# Isi artikel', ...overrides } as never,
      't',
    );

  const publish = async (w: Awaited<ReturnType<typeof tenantWith>>, overrides: Record<string, unknown> = {}) => {
    const created = (await draft(w, overrides)).data;
    await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't');
    await s.articleModeration.approve(admin(w.reviewer), created.id, 'good', 't');
    return created;
  };

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
    s = buildCommerceStack();
  });

  afterAll(async () => {
    await s.prisma.$disconnect();
    await pool.end();
  });

  describe('authoring', () => {
    it('creates a draft with a first version and a unique slug per tenant', async () => {
      const w = await tenantWith();
      const first = (await draft(w)).data;
      const second = (await draft(w)).data;

      expect(first).toMatchObject({ status: 'DRAFT', slug: 'jurnal-penyesuaian', accessType: 'FREE', authorId: w.author });
      expect(second.slug).toBe('jurnal-penyesuaian-2');
      const versions = await pool.query(`SELECT "versionNumber", "publishedAt" FROM "ArticleVersion" WHERE "articleId" = $1`, [first.id]);
      expect(versions.rows).toEqual([{ versionNumber: 1, publishedAt: null }]);
      expect(await count(`SELECT count(*) FROM "AuditLog" WHERE action = 'ARTICLE_CREATED' AND "entityId" = $1`, [first.id])).toBe(1);

      const other = await tenantWith();
      expect((await draft(other)).data.slug).toBe('jurnal-penyesuaian');
    });

    it('enforces the pricing rules', async () => {
      const w = await tenantWith();
      await expect(draft(w, { accessType: 'PAID' })).rejects.toMatchObject({ statusCode: 422 });
      await expect(draft(w, { accessType: 'FREE', price: 1000 })).rejects.toMatchObject({ statusCode: 422 });
      await expect(draft(w, { accessType: 'PAID', price: 0 })).rejects.toMatchObject({ statusCode: 422 });
      const paid = (await draft(w, { accessType: 'PAID', price: '25000.50' })).data;
      expect(paid.price?.toString()).toBe('25000.5');

      const toFree = await s.articleAuthoring.update(teacher(w.author), w.authorCtx, paid.id, { accessType: 'FREE' }, 't');
      expect(toFree.data).toMatchObject({ accessType: 'FREE', price: null });
      await expect(
        s.articleAuthoring.update(teacher(w.author), w.authorCtx, paid.id, { accessType: 'PAID' }, 't'),
      ).rejects.toMatchObject({ statusCode: 422 });
      const back = await s.articleAuthoring.update(teacher(w.author), w.authorCtx, paid.id, { accessType: 'PAID', price: 5000 }, 't');
      expect(back.data.price?.toString()).toBe('5000');
    });

    it('lets the author edit a draft and changes the working version, not a new one', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      await s.articleAuthoring.update(teacher(w.author), w.authorCtx, created.id, { title: 'Judul baru', content: 'Isi baru' }, 't');
      const rows = await pool.query(`SELECT "versionNumber", title, content FROM "ArticleVersion" WHERE "articleId" = $1`, [created.id]);
      expect(rows.rows).toEqual([{ versionNumber: 1, title: 'Judul baru', content: 'Isi baru' }]);
    });

    it('keeps teachers apart: same-tenant peers cannot edit each other, managers can, other tenants see nothing', async () => {
      const w = await tenantWith();
      const peer = await insertUser(pool, 'TEACHER');
      await insertMembership(pool, w.tenant, peer, 'TEACHER');
      const peerCtx = ctx(peer, w.tenant, TenantRole.TEACHER);
      const created = (await draft(w)).data;

      await expect(s.articleAuthoring.update(teacher(peer), peerCtx, created.id, { title: 'Hijack' }, 't')).rejects.toMatchObject({ statusCode: 403, code: 'OWNERSHIP_DENIED' });
      await expect(s.articleAuthoring.findOne(teacher(peer), peerCtx, created.id)).rejects.toMatchObject({ statusCode: 404 });
      expect((await s.articleAuthoring.list(teacher(peer), peerCtx, { page: 1, limit: 20 })).data.data).toHaveLength(0);

      await expect(s.articleAuthoring.update(teacher(w.editor), w.editorCtx, created.id, { title: 'Edited by editor' }, 't')).resolves.toBeDefined();
      expect((await s.articleAuthoring.list(teacher(w.owner), w.ownerCtx, { page: 1, limit: 20 })).data.data.length).toBeGreaterThanOrEqual(1);

      const stranger = await tenantWith();
      await expect(s.articleAuthoring.findOne(teacher(stranger.owner), stranger.ownerCtx, created.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.articleAuthoring.update(teacher(stranger.owner), stranger.ownerCtx, created.id, { title: 'Cross-tenant' }, 't')).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.articleAuthoring.submitReview(teacher(stranger.owner), stranger.ownerCtx, created.id, 't')).rejects.toMatchObject({ statusCode: 404 });
      expect((await one(`SELECT title FROM "Article" WHERE id = $1`, [created.id])).title).toBe('Edited by editor');
    });

    it('never writes through for a platform administrator acting without membership', async () => {
      const w = await tenantWith();
      const adminCtx: TenantContext = { userId: w.reviewer, tenantId: w.tenant, tenantRole: null, isPlatformAdmin: true };
      await expect(
        s.articleAuthoring.create(admin(w.reviewer), adminCtx, { title: 'Admin article', accessType: 'FREE', content: 'x' } as never, 't'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('validates the cover image against the caller uploads', async () => {
      const strict = buildCommerceStack({ ownsFile: () => false });
      try {
        const w = await tenantWith();
        await expect(
          strict.articleAuthoring.create(
            teacher(w.author),
            w.authorCtx,
            { title: 'Cover', accessType: 'FREE', content: 'x', coverImage: proofFor(w.author) } as never,
            't',
          ),
        ).rejects.toMatchObject({ statusCode: 422 });
        const ok = await s.articleAuthoring.create(
          teacher(w.author),
          w.authorCtx,
          { title: 'Cover', accessType: 'FREE', content: 'x', coverImage: proofFor(w.author) } as never,
          't',
        );
        expect(ok.data.coverImage).toMatchObject({ fileId: `images/${w.author}-proof` });
      } finally {
        await strict.prisma.$disconnect();
      }
    });
  });

  describe('review and publication', () => {
    it('needs review before anything becomes visible, and locks content while under review', async () => {
      const w = await tenantWith();
      const created = (await draft(w, { accessType: 'PAID', price: 10000 })).data;
      expect((await s.marketplaceArticles.list({ page: 1, limit: 50, sort: 'newest' })).data.data.map((a) => a.id)).not.toContain(created.id);

      const submitted = await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't');
      expect(submitted.data).toMatchObject({ status: 'PENDING_REVIEW' });
      expect((await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't')).message).toMatch(/already/);
      await expect(s.articleAuthoring.update(teacher(w.author), w.authorCtx, created.id, { title: 'Sneaky edit' }, 't')).rejects.toMatchObject({ statusCode: 409, code: 'CONTENT_LOCKED' });

      const queue = await s.articleModeration.queue(admin(w.reviewer), { page: 1, limit: 50, status: 'PENDING_REVIEW' });
      expect(queue.data.data.map((a) => a.id)).toContain(created.id);
      await expect(s.articleModeration.queue(teacher(w.author), { page: 1, limit: 50, status: 'PENDING_REVIEW' })).rejects.toMatchObject({ status: 403 });
      await expect(s.articleModeration.approve(teacher(w.author), created.id, undefined, 't')).rejects.toMatchObject({ status: 403 });
    });

    it('publishes the version exactly once and freezes it', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't');

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => s.articleModeration.approve(admin(w.reviewer), created.id, 'approved', 't')),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(results.filter((r) => r.status === 'fulfilled' && (r.value.data as { changed: boolean }).changed)).toHaveLength(1);

      const article = await one(`SELECT status::text, "publishedVersionId", "publishedAt" IS NOT NULL AS published, "reviewedById" FROM "Article" WHERE id = $1`, [created.id]);
      expect(article).toMatchObject({ status: 'PUBLISHED', published: true, reviewedById: w.reviewer });
      const version = await one(`SELECT "publishedAt" IS NOT NULL AS published FROM "ArticleVersion" WHERE id = $1`, [article.publishedVersionId]);
      expect(version.published).toBe(true);
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'ArticlePublished' AND "aggregateId" = $1`, [created.id])).toBe(1);
      expect(await count(`SELECT count(*) FROM "AuditLog" WHERE action = 'ARTICLE_APPROVED' AND "entityId" = $1`, [created.id])).toBe(1);

      await expect(pool.query(`UPDATE "ArticleVersion" SET content = 'changed' WHERE id = $1`, [article.publishedVersionId])).rejects.toMatchObject({ code: expect.stringMatching(/^23/) });
      await expect(s.articleAuthoring.update(teacher(w.author), w.authorCtx, created.id, { content: 'edit after publish' }, 't')).rejects.toMatchObject({ code: 'CONTENT_LOCKED' });
    });

    it('rejection carries a reason, allows a fix and a second review', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't');
      await s.articleModeration.reject(admin(w.reviewer), created.id, 'Too short, add examples', 't');

      const seen = await s.articleAuthoring.findOne(teacher(w.author), w.authorCtx, created.id);
      expect(seen.data).toMatchObject({ status: 'REJECTED', reviewNote: 'Too short, add examples' });
      await s.articleAuthoring.update(teacher(w.author), w.authorCtx, created.id, { content: 'Longer content with examples' }, 't');
      await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't');
      await s.articleModeration.approve(admin(w.reviewer), created.id, undefined, 't');
      expect((await one(`SELECT status::text FROM "Article" WHERE id = $1`, [created.id])).status).toBe('PUBLISHED');
      expect(await count(`SELECT count(*) FROM "ArticleVersion" WHERE "articleId" = $1`, [created.id])).toBe(1);
    });

    it('cannot be approved while the tenant is not active, nor by a concurrent reject and approve both', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't');
      await pool.query(`UPDATE "Tenant" SET status = 'SUSPENDED' WHERE id = $1`, [w.tenant]);
      await expect(s.articleModeration.approve(admin(w.reviewer), created.id, undefined, 't')).rejects.toMatchObject({ statusCode: 409 });
      await pool.query(`UPDATE "Tenant" SET status = 'ACTIVE' WHERE id = $1`, [w.tenant]);

      const outcomes = await Promise.allSettled([
        s.articleModeration.approve(admin(w.reviewer), created.id, undefined, 't'),
        s.articleModeration.reject(admin(w.reviewer), created.id, 'not good enough', 't'),
      ]);
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      const final = (await one(`SELECT status::text FROM "Article" WHERE id = $1`, [created.id])).status;
      expect(['PUBLISHED', 'REJECTED']).toContain(final);
    });

    it('can be withdrawn from review and archived by the author, but not skip review', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, created.id, 't');
      expect((await s.articleAuthoring.withdraw(teacher(w.author), w.authorCtx, created.id, 't')).data).toMatchObject({ status: 'DRAFT' });
      await expect(s.articleModeration.approve(admin(w.reviewer), created.id, undefined, 't')).rejects.toMatchObject({ statusCode: 409 });
      expect((await s.articleAuthoring.archive(teacher(w.author), w.authorCtx, created.id, 't')).data).toMatchObject({ status: 'ARCHIVED' });
      await expect(s.articleAuthoring.update(teacher(w.author), w.authorCtx, created.id, { title: 'Zombie' }, 't')).rejects.toMatchObject({ code: 'CONTENT_LOCKED' });
    });

    it('a suspended article can only be archived by an administrator', async () => {
      const w = await tenantWith();
      const created = await publish(w);
      await s.articleModeration.suspend(admin(w.reviewer), created.id, 'Copyright complaint', 't');
      await expect(s.articleAuthoring.archive(teacher(w.author), w.authorCtx, created.id, 't')).rejects.toMatchObject({ statusCode: 403 });
      await s.articleModeration.archive(admin(w.reviewer), created.id, undefined, 't');
      expect((await one(`SELECT status::text FROM "Article" WHERE id = $1`, [created.id])).status).toBe('ARCHIVED');
    });
  });

  describe('marketplace', () => {
    it('lists only published articles of active tenants, without content or moderation notes', async () => {
      const w = await tenantWith();
      const published = await publish(w, { title: 'Terbit dan tampil', excerpt: 'ringkas' });
      const hidden = (await draft(w, { title: 'Masih draft' })).data;
      const pending = (await draft(w, { title: 'Menunggu review' })).data;
      await s.articleAuthoring.submitReview(teacher(w.author), w.authorCtx, pending.id, 't');

      const listing = await s.marketplaceArticles.list({ page: 1, limit: 50, sort: 'newest', tenantId: w.tenant });
      const ids = listing.data.data.map((a) => a.id);
      expect(ids).toEqual([published.id]);
      expect(ids).not.toContain(hidden.id);
      const serialized = JSON.stringify(listing.data.data[0]);
      expect(serialized).not.toContain('Isi artikel');
      expect(serialized).not.toContain('reviewNote');
      expect(serialized).not.toContain('email');
      expect(listing.data.data[0]).toMatchObject({ title: 'Terbit dan tampil', tenant: { id: w.tenant }, author: { id: w.author } });

      await pool.query(`UPDATE "Tenant" SET status = 'SUSPENDED' WHERE id = $1`, [w.tenant]);
      expect((await s.marketplaceArticles.list({ page: 1, limit: 50, sort: 'newest', tenantId: w.tenant })).data.data).toHaveLength(0);
      await expect(s.marketplaceArticles.findOne(published.id)).rejects.toMatchObject({ statusCode: 404, code: 'CONTENT_NOT_PUBLISHED' });
    });

    it('filters and sorts', async () => {
      const w = await tenantWith();
      await publish(w, { title: 'Akuntansi dasar', accessType: 'PAID', price: 30000 });
      await publish(w, { title: 'Pajak penghasilan', accessType: 'PAID', price: 10000 });
      await publish(w, { title: 'Etika profesi', accessType: 'FREE' });

      const base = { page: 1, limit: 50, tenantId: w.tenant } as const;
      expect((await s.marketplaceArticles.list({ ...base, sort: 'title' })).data.data.map((a) => a.title)).toEqual(['Akuntansi dasar', 'Etika profesi', 'Pajak penghasilan']);
      expect((await s.marketplaceArticles.list({ ...base, sort: 'price_asc', accessType: 'PAID' })).data.data.map((a) => a.title)).toEqual(['Pajak penghasilan', 'Akuntansi dasar']);
      expect((await s.marketplaceArticles.list({ ...base, sort: 'newest', q: 'pajak' })).data.data.map((a) => a.title)).toEqual(['Pajak penghasilan']);
      const page = await s.marketplaceArticles.list({ page: 2, limit: 2, sort: 'title', tenantId: w.tenant });
      expect(page.data).toMatchObject({ pagination: { total: 3, totalPages: 2 } });
      expect(page.data.data).toHaveLength(1);
    });

    it('serves free content to any signed-in learner and premium content only with an entitlement', async () => {
      const w = await tenantWith();
      const free = await publish(w, { title: 'Gratis', content: 'Isi gratis' });
      const premium = await publish(w, { title: 'Premium', accessType: 'PAID', price: 50000, content: 'Isi premium rahasia' });
      const learner = await insertUser(pool);

      const freeRead = await s.marketplaceArticles.content(student(learner), free.id);
      expect(freeRead.data).toMatchObject({ content: 'Isi gratis', versionNumber: 1 });
      expect((await s.marketplaceArticles.access(student(learner), premium.id)).data).toMatchObject({ accessible: false, reason: 'ENTITLEMENT_REQUIRED' });
      await expect(s.marketplaceArticles.content(student(learner), premium.id)).rejects.toMatchObject({ statusCode: 403, code: 'ENTITLEMENT_REQUIRED' });

      const order = (await s.orders.create(student(learner), { items: [{ type: 'ARTICLE', id: premium.id }] }, 't')).data;
      const submitted = await s.manual.submit(student(learner), order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(learner) }, 't');
      await expect(s.marketplaceArticles.content(student(learner), premium.id)).rejects.toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
      await s.manual.approve(admin(w.reviewer), submitted.data.submission.id, 'verified', 't');

      expect((await s.marketplaceArticles.access(student(learner), premium.id)).data).toMatchObject({ accessible: true, reason: 'ENTITLED' });
      expect((await s.marketplaceArticles.content(student(learner), premium.id)).data.content).toBe('Isi premium rahasia');

      const other = await insertUser(pool);
      await expect(s.marketplaceArticles.content(student(other), premium.id)).rejects.toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
    });

    it('withdraws access when content is suspended, and lets buyers keep archived purchases', async () => {
      const w = await tenantWith();
      const premium = await publish(w, { title: 'Premium', accessType: 'PAID', price: 50000, content: 'Rahasia' });
      const free = await publish(w, { title: 'Gratis', content: 'Terbuka' });
      const learner = await insertUser(pool);
      const order = (await s.orders.create(student(learner), { items: [{ type: 'ARTICLE', id: premium.id }] }, 't')).data;
      const submitted = await s.manual.submit(student(learner), order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(learner) }, 't');
      await s.manual.approve(admin(w.reviewer), submitted.data.submission.id, 'ok', 't');
      const bystander = await insertUser(pool);

      await s.articleModeration.suspend(admin(w.reviewer), premium.id, 'Under investigation', 't');
      await expect(s.marketplaceArticles.content(student(learner), premium.id)).rejects.toMatchObject({ statusCode: 404 });

      await s.articleModeration.reinstate(admin(w.reviewer), premium.id, undefined, 't');
      expect((await s.marketplaceArticles.content(student(learner), premium.id)).data.content).toBe('Rahasia');

      await s.articleModeration.archive(admin(w.reviewer), premium.id, undefined, 't');
      expect((await s.marketplaceArticles.content(student(learner), premium.id)).data.content).toBe('Rahasia');
      await expect(s.marketplaceArticles.content(student(bystander), premium.id)).rejects.toMatchObject({ statusCode: 403 });

      await s.articleModeration.archive(admin(w.reviewer), free.id, undefined, 't');
      await expect(s.marketplaceArticles.content(student(bystander), free.id)).rejects.toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
      await expect(s.marketplaceArticles.findOne(free.id)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('purchase integration', () => {
    it('sends the creator share of a sold article to the article author wallet', async () => {
      const w = await tenantWith();
      const premium = await publish(w, { title: 'Berbayar', accessType: 'PAID', price: 100000 });
      const learner = await insertUser(pool);
      const order = (await s.orders.create(student(learner), { items: [{ type: 'ARTICLE', id: premium.id }] }, 't')).data;
      const submitted = await s.manual.submit(student(learner), order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(learner) }, 't');
      await s.manual.approve(admin(w.reviewer), submitted.data.submission.id, 'ok', 't');

      const wallet = await one(`SELECT "ownerId", balance::text AS balance FROM "Wallet" WHERE "tenantId" = $1`, [w.tenant]);
      expect(wallet).toEqual({ ownerId: w.author, balance: '90000.00' });
    });
  });
});
