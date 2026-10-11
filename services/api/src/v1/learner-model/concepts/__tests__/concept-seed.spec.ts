import {
  AliasEntry,
  GoldenGraphFile,
  LinkFile,
  aliasRows,
  conceptRows,
  prerequisiteRows,
  validateConceptSeed,
} from '../concept-seed';

const graph = (): GoldenGraphFile => ({
  levels: [
    {
      id: 1,
      title: 'One',
      topics: [
        { id: 'a', title: 'A', description: 'first', prerequisites: [], estimatedMinutes: 30 },
        { id: 'b', title: 'B', prerequisites: ['a'] },
      ],
    },
    { id: 2, title: 'Two', topics: [{ id: 'c', title: 'C', prerequisites: ['a', 'b'] }] },
  ],
});

const alias = (overrides: Partial<AliasEntry> = {}): AliasEntry => ({
  scheme: 'PYTHON_DOMAIN',
  alias: 'x',
  kind: 'EXACT',
  status: 'APPROVED',
  targets: ['a'],
  ...overrides,
});

const links = (overrides: Partial<LinkFile> = {}): LinkFile => ({
  topicSlug: 'topic',
  subTopics: [{ title: 'S', status: 'APPROVED', conceptIds: ['a'] }],
  lessons: [],
  ...overrides,
});

const issues = (input: { graph?: GoldenGraphFile; aliases?: AliasEntry[]; links?: LinkFile }) =>
  validateConceptSeed({ graph: input.graph ?? graph(), aliases: input.aliases ?? [alias()], links: input.links ?? links() });

describe('concept seed rows', () => {
  it('numbers concepts inside their level and carries level, minutes and description', () => {
    expect(conceptRows(graph())).toEqual([
      { id: 'a', title: 'A', description: 'first', level: 1, sortOrder: 1, estimatedMinutes: 30 },
      { id: 'b', title: 'B', description: null, level: 1, sortOrder: 2, estimatedMinutes: null },
      { id: 'c', title: 'C', description: null, level: 2, sortOrder: 1, estimatedMinutes: null },
    ]);
  });

  it('lists every prerequisite pair', () => {
    expect(prerequisiteRows(graph())).toEqual([
      { conceptId: 'b', requiresId: 'a' },
      { conceptId: 'c', requiresId: 'a' },
      { conceptId: 'c', requiresId: 'b' },
    ]);
  });

  it('gives an alias one deterministic row per target and one row without a target when unmatched', () => {
    const rows = aliasRows([
      alias({ alias: 'one', targets: ['a', 'b'], kind: 'UMBRELLA', status: 'PROPOSED' }),
      alias({ alias: 'two', targets: [], kind: 'UNMATCHED', status: 'PROPOSED' }),
    ]);

    expect(rows.map((r) => [r.id, r.conceptId, r.kind, r.status])).toEqual([
      ['PYTHON_DOMAIN:one:a', 'a', 'UMBRELLA', 'PROPOSED'],
      ['PYTHON_DOMAIN:one:b', 'b', 'UMBRELLA', 'PROPOSED'],
      ['PYTHON_DOMAIN:two:none', null, 'UNMATCHED', 'PROPOSED'],
    ]);
  });
});

describe('concept seed validation', () => {
  it('accepts a consistent seed', () => {
    expect(issues({})).toEqual([]);
  });

  it('rejects a duplicate concept id', () => {
    const g = graph();
    g.levels[1].topics.push({ id: 'a', title: 'again', prerequisites: [] });

    expect(issues({ graph: g })).toContainEqual(expect.stringContaining('duplicate concept id a'));
  });

  it('rejects a prerequisite that does not exist and a concept that requires itself', () => {
    const g = graph();
    g.levels[0].topics[1].prerequisites = ['missing', 'b'];

    const found = issues({ graph: g });

    expect(found).toContainEqual(expect.stringContaining('b requires unknown concept missing'));
    expect(found).toContainEqual(expect.stringContaining('b requires itself'));
  });

  it('rejects a prerequisite cycle and names it', () => {
    const g = graph();
    g.levels[0].topics[0].prerequisites = ['c'];

    expect(issues({ graph: g })).toContainEqual(expect.stringMatching(/prerequisite cycle: .*a.*c|prerequisite cycle: .*c.*a/));
  });

  it('rejects an alias with an unknown target or without a target', () => {
    expect(issues({ aliases: [alias({ targets: ['nope'] })] })).toContainEqual(expect.stringContaining('alias x targets unknown concept nope'));
    expect(issues({ aliases: [alias({ targets: [] })] })).toContainEqual(expect.stringContaining('alias x of kind EXACT needs a target'));
  });

  it('rejects an unmatched alias that has a target or is approved', () => {
    const withTarget = issues({ aliases: [alias({ kind: 'UNMATCHED', status: 'PROPOSED', targets: ['a'] })] });
    const approved = issues({ aliases: [alias({ kind: 'UNMATCHED', status: 'APPROVED', targets: [] })] });

    expect(withTarget).toContainEqual(expect.stringContaining('alias x is UNMATCHED and must not have a target'));
    expect(approved).toContainEqual(expect.stringContaining('alias x is UNMATCHED and cannot be APPROVED'));
  });

  it('rejects the same alias listed twice in one scheme', () => {
    expect(issues({ aliases: [alias(), alias({ targets: ['b'] })] })).toContainEqual(expect.stringContaining('alias x is listed twice in PYTHON_DOMAIN'));
  });

  it('rejects links that point at an unknown concept or repeat a sub-topic or lesson', () => {
    const unknown = issues({ links: links({ subTopics: [{ title: 'S', status: 'APPROVED', conceptIds: ['nope'] }] }) });
    const repeated = issues({
      links: links({
        subTopics: [
          { title: 'S', status: 'APPROVED', conceptIds: ['a'] },
          { title: 'S', status: 'PROPOSED', conceptIds: ['b'] },
        ],
        lessons: [
          { subTopicTitle: 'S', title: 'L', status: 'APPROVED', conceptIds: ['a'] },
          { subTopicTitle: 'S', title: 'L', status: 'APPROVED', conceptIds: ['b'] },
        ],
      }),
    });

    expect(unknown).toContainEqual(expect.stringContaining('sub-topic link S targets unknown concept nope'));
    expect(repeated).toContainEqual(expect.stringContaining('sub-topic S is linked twice'));
    expect(repeated).toContainEqual(expect.stringContaining('lesson S / L is linked twice'));
  });

  it('rejects a link without any concept', () => {
    expect(issues({ links: links({ subTopics: [{ title: 'S', status: 'APPROVED', conceptIds: [] }] }) })).toContainEqual(
      expect.stringContaining('sub-topic link S has no concept'),
    );
  });
});
