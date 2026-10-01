import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import {
  createPool,
  describeDb,
  expectViolation,
  withRollback,
} from '@/test-utils/pg-fixtures';

describeDb('prerequisite service - cycle detection (pure logic)', () => {
  describe('pure cycle detection helpers', () => {
    function detectCyclePure(edges: Array<[string, string]>, start: string): string[] | null {
      const adj = new Map<string, string[]>();
      for (const [from, to] of edges) {
        const list = adj.get(from) ?? [];
        list.push(to);
        adj.set(from, list);
      }
      const visited = new Set<string>();
      const onStack = new Set<string>();
      const path: string[] = [];
      function visit(id: string): string[] | null {
        if (onStack.has(id)) {
          const idx = path.indexOf(id);
          return idx >= 0 ? [...path.slice(idx), id] : [id, id];
        }
        if (visited.has(id)) return null;
        visited.add(id);
        onStack.add(id);
        path.push(id);
        for (const next of adj.get(id) ?? []) {
          const cycle = visit(next);
          if (cycle) return cycle;
        }
        onStack.delete(id);
        path.pop();
        return null;
      }
      return visit(start);
    }

    it('returns null on an acyclic graph', () => {
      expect(
        detectCyclePure(
          [
            ['a', 'b'],
            ['b', 'c'],
          ],
          'a',
        ),
      ).toBeNull();
    });

    it('detects a direct cycle', () => {
      const cycle = detectCyclePure([['a', 'b'], ['b', 'a']], 'a');
      expect(cycle).toEqual(['a', 'b', 'a']);
    });

    it('detects a deeper cycle', () => {
      const cycle = detectCyclePure(
        [
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'd'],
          ['d', 'b'],
        ],
        'a',
      );
      expect(cycle).toEqual(['b', 'c', 'd', 'b']);
    });
  });

  describe('database invariants', () => {
    let pool: Pool;

    beforeAll(() => {
      pool = createPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it('rejects a self-edge insert (CHECK constraint)', () =>
      withRollback(pool, async (c) => {
        const id = randomUUID();
        await c.query(
          `INSERT INTO "Topic" (id, title, slug, image, price, "topicDuration", "createdAt", "updatedAt")
           VALUES ($1, 'SelfEdgeTopic', $2, '{}'::jsonb, 0, 30, now(), now())`,
          [id, `self-edge-topic-${id.slice(0, 8)}`],
        );
        await c.query(
          `INSERT INTO "SubTopic" (id, title, "sortOrder", "topicId", "createdAt", "updatedAt")
           VALUES ($1, 'Self', 1, $2, now(), now())`,
          [id, id],
        );
        const error = await expectViolation(
          c,
          `INSERT INTO "SubTopicPrerequisite" (id, "subTopicId", "requiresId", "createdAt") VALUES (gen_random_uuid()::text, $1, $1, now())`,
          [id],
        );
        expect(error.constraint).toBe('SubTopicPrerequisite_no_self_edge');
      }));

    it('rejects a duplicate pair (UNIQUE constraint)', () =>
      withRollback(pool, async (c) => {
        const topicId = randomUUID();
        await c.query(
          `INSERT INTO "Topic" (id, title, slug, image, price, "topicDuration", "createdAt", "updatedAt")
           VALUES ($1, 'DupTopic', $2, '{}'::jsonb, 0, 30, now(), now())`,
          [topicId, `dup-topic-${topicId.slice(0, 8)}`],
        );
        const subA = randomUUID();
        const subB = randomUUID();
        await c.query(
          `INSERT INTO "SubTopic" (id, title, "sortOrder", "topicId", "createdAt", "updatedAt")
           VALUES ($1, 'A', 1, $2, now(), now()), ($3, 'B', 2, $2, now(), now())`,
          [subA, topicId, subB],
        );
        await c.query(
          `INSERT INTO "SubTopicPrerequisite" (id, "subTopicId", "requiresId", "createdAt") VALUES (gen_random_uuid()::text, $1, $2, now())`,
          [subA, subB],
        );
        const error = await expectViolation(
          c,
          `INSERT INTO "SubTopicPrerequisite" (id, "subTopicId", "requiresId", "createdAt") VALUES (gen_random_uuid()::text, $1, $2, now())`,
          [subA, subB],
        );
        expect(error.code).toBe('23505');
      }));
  });
});
