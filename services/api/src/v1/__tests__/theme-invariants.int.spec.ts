import { randomUUID } from 'crypto';
import {
  createPool,
  describeDb,
  expectViolation,
  insertTenant,
  insertUser,
  withRollback,
} from '@/test-utils/pg-fixtures';

const INSERT_THEME = `INSERT INTO "Theme" (id, slug, title, "primary", secondary, status, scope, version, "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6::"ThemeStatus", $7::"ThemeScope", 1, now(), now())`;

const INSERT_DEFAULT_THEME = `INSERT INTO "Theme" (id, slug, title, "primary", secondary, status, scope, "isDefault", version, "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6::"ThemeStatus", $7::"ThemeScope", true, 1, now(), now())`;

const INSERT_TENANT_THEME = `INSERT INTO "Theme" (id, slug, title, "primary", secondary, status, scope, "tenantId", version, "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, $6::"ThemeStatus", $7::"ThemeScope", $8, 1, now(), now())`;

describeDb('theme database invariants', () => {
  const pool = createPool();

  beforeEach(async () => {
    await pool.query('UPDATE "Theme" SET "isDefault" = false WHERE "isDefault" = true');
  });

  describe('theme deletion keeps curriculum rows', () => {
    it('deleting a Theme sets themeId = null on Topic, SubTopic, Lesson, Step without removing the rows', () =>
      withRollback(pool, async (c) => {
        const owner = await insertUser(c, 'TEACHER');
        await insertTenant(c, owner);

        const themeId = randomUUID();
        await c.query(INSERT_THEME, [
          themeId,
          `theme-${themeId.slice(0, 8)}`,
          'DelTest',
          '#000000',
          '#FFFFFF',
          'PUBLISHED',
          'GLOBAL',
        ]);

        const topicId = randomUUID();
        await c.query(
          `INSERT INTO "Topic" (id, title, slug, image, price, "topicDuration", "themeId", "createdAt", "updatedAt")
           VALUES ($1, 'Topic', $2, '{}'::jsonb, 0, 30, $3, now(), now())`,
          [topicId, `topic-${topicId.slice(0, 8)}`, themeId],
        );

        const subId = randomUUID();
        await c.query(
          `INSERT INTO "SubTopic" (id, title, "sortOrder", "topicId", "themeId", "createdAt", "updatedAt")
           VALUES ($1, 'Sub', 1, $2, $3, now(), now())`,
          [subId, topicId, themeId],
        );

        const lessonId = randomUUID();
        await c.query(
          `INSERT INTO "Lesson" (id, title, "sortOrder", "subTopicId", "themeId", "createdAt", "updatedAt")
           VALUES ($1, 'Lesson', 1, $2, $3, now(), now())`,
          [lessonId, subId, themeId],
        );

        const stepId = randomUUID();
        await c.query(
          `INSERT INTO "Step" (id, title, "sortOrder", "lessonId", "themeId", "createdAt", "updatedAt")
           VALUES ($1, 'Step', 1, $2, $3, now(), now())`,
          [stepId, lessonId, themeId],
        );

        await c.query(`DELETE FROM "Theme" WHERE id = $1`, [themeId]);

        const curriculum = await c.query(
          `SELECT
             (SELECT "themeId" FROM "Topic" WHERE id = $1) AS topic_theme,
             (SELECT "themeId" FROM "SubTopic" WHERE id = $2) AS sub_theme,
             (SELECT "themeId" FROM "Lesson" WHERE id = $3) AS lesson_theme,
             (SELECT "themeId" FROM "Step" WHERE id = $4) AS step_theme,
             (SELECT EXISTS (SELECT 1 FROM "Topic" WHERE id = $1)) AS topic_exists,
             (SELECT EXISTS (SELECT 1 FROM "SubTopic" WHERE id = $2)) AS sub_exists,
             (SELECT EXISTS (SELECT 1 FROM "Lesson" WHERE id = $3)) AS lesson_exists,
             (SELECT EXISTS (SELECT 1 FROM "Step" WHERE id = $4)) AS step_exists`,
          [topicId, subId, lessonId, stepId],
        );

        const row = curriculum.rows[0];
        expect(row.topic_theme).toBeNull();
        expect(row.sub_theme).toBeNull();
        expect(row.lesson_theme).toBeNull();
        expect(row.step_theme).toBeNull();
        expect(row.topic_exists).toBe(true);
        expect(row.sub_exists).toBe(true);
        expect(row.lesson_exists).toBe(true);
        expect(row.step_exists).toBe(true);
      }));
  });

  describe('default theme invariants', () => {
    it('rejects a second theme with isDefault = true', () =>
      withRollback(pool, async (c) => {
        const firstId = randomUUID();
        await c.query(INSERT_DEFAULT_THEME, [
          firstId,
          `theme-a-${firstId.slice(0, 8)}`,
          'A',
          '#000000',
          '#FFFFFF',
          'PUBLISHED',
          'GLOBAL',
        ]);

        const secondId = randomUUID();
        const error = await expectViolation(
          c,
          INSERT_DEFAULT_THEME,
          [secondId, `theme-b-${secondId.slice(0, 8)}`, 'B', '#000000', '#FFFFFF', 'PUBLISHED', 'GLOBAL'],
        );
        expect(error.constraint).toBe('Theme_single_default');
      }));

    it('rejects a default theme that is not PUBLISHED and GLOBAL', () =>
      withRollback(pool, async (c) => {
        const id = randomUUID();
        const error = await expectViolation(
          c,
          INSERT_DEFAULT_THEME,
          [id, `theme-bad-${id.slice(0, 8)}`, 'BadDefault', '#000000', '#FFFFFF', 'DRAFT', 'GLOBAL'],
        );
        expect(error.code).toBe('23514');
        expect(String(error.message)).toMatch(/Theme_default_is_published_global/);
      }));
  });

  describe('tenant scope invariants', () => {
    it('rejects TENANT scope without tenantId', () =>
      withRollback(pool, async (c) => {
        const id = randomUUID();
        const error = await expectViolation(
          c,
          INSERT_THEME,
          [id, `theme-bad-tenant-${id.slice(0, 8)}`, 'BadTenant', '#000000', '#FFFFFF', 'PUBLISHED', 'TENANT'],
        );
        expect(error.code).toBe('23514');
        expect(String(error.message)).toMatch(/Theme_tenant_scope/);
      }));

    it('accepts TENANT scope with tenantId set', () =>
      withRollback(pool, async (c) => {
        const owner = await insertUser(c, 'TEACHER');
        const tenant = await insertTenant(c, owner);

        const id = randomUUID();
        await c.query(INSERT_TENANT_THEME, [
          id,
          `theme-good-tenant-${id.slice(0, 8)}`,
          'TenantTheme',
          '#000000',
          '#FFFFFF',
          'PUBLISHED',
          'TENANT',
          tenant,
        ]);

        const result = await c.query(
          `SELECT scope::text AS scope, "tenantId" FROM "Theme" WHERE id = $1`,
          [id],
        );
        expect(result.rows[0].scope).toBe('TENANT');
        expect(result.rows[0].tenantId).toBe(tenant);
      }));
  });
});
