import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SEED_ROOT = join(REPO_ROOT, 'prisma', 'seed-data');
const GRAPH_PATH = join(SEED_ROOT, 'golden-accounting-graph.json');
const SCENARIOS_PATH = join(SEED_ROOT, 'golden-scenarios.json');

describe('golden-accounting-graph.json (Phase 1)', () => {
  const graph = JSON.parse(readFileSync(GRAPH_PATH, 'utf-8'));

  it('has 4 levels', () => {
    expect(graph.levels.map((l: { id: number }) => l.id)).toEqual([1, 2, 3, 4]);
  });

  it.each([1, 2, 3, 4])('level %i has at least 15 topics', (levelId: number) => {
    const level = graph.levels.find((l: { id: number }) => l.id === levelId);
    expect(level).toBeDefined();
    expect(level.topics.length).toBeGreaterThanOrEqual(15);
  });

  it('every prerequisite points to an existing topicId', () => {
    const allIds = new Set<string>();
    for (const level of graph.levels) {
      for (const topic of level.topics) {
        allIds.add(topic.id);
      }
    }
    for (const level of graph.levels) {
      for (const topic of level.topics) {
        for (const prereqId of topic.prerequisites ?? []) {
          expect(allIds.has(prereqId)).toBe(true);
        }
      }
    }
  });
});

describe('golden-scenarios.json (Phase 1)', () => {
  const graph = JSON.parse(readFileSync(GRAPH_PATH, 'utf-8'));
  const scenarios = JSON.parse(readFileSync(SCENARIOS_PATH, 'utf-8'));
  const topicIds = new Set<string>();
  for (const level of graph.levels) {
    for (const topic of level.topics) {
      topicIds.add(topic.id);
    }
  }

  it('has at least 6 scenarios', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(6);
  });

  it('every scenario topicId exists in the golden graph', () => {
    for (const scenario of scenarios) {
      expect(topicIds.has(scenario.topicId)).toBe(true);
    }
  });

  it('every scenario has at least 1 expected line and the line totals balance', () => {
    for (const scenario of scenarios) {
      expect(scenario.expectedLines.length).toBeGreaterThanOrEqual(1);
      const totalDebit = scenario.expectedLines
        .filter((line: { side: string }) => line.side === 'DEBIT')
        .reduce((sum: number, line: { amount: number }) => sum + line.amount, 0);
      const totalCredit = scenario.expectedLines
        .filter((line: { side: string }) => line.side === 'CREDIT')
        .reduce((sum: number, line: { amount: number }) => sum + line.amount, 0);
      expect(totalDebit).toBe(totalCredit);
    }
  });
});