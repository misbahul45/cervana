import { z } from 'zod';

const reviewStatus = z.enum(['PROPOSED', 'APPROVED', 'REJECTED']);
const aliasKind = z.enum(['EXACT', 'PART_OF', 'UMBRELLA', 'UNMATCHED']);

const goldenGraphSchema = z.object({
  levels: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      topics: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          prerequisites: z.array(z.string()),
          estimatedMinutes: z.number().int().positive().optional(),
        }),
      ),
    }),
  ),
});

const aliasSchema = z.array(
  z.object({
    scheme: z.string().min(1),
    alias: z.string().min(1),
    kind: aliasKind,
    status: reviewStatus,
    targets: z.array(z.string()),
    note: z.string().optional(),
  }),
);

const linkSchema = z.object({
  topicSlug: z.string().min(1),
  subTopics: z.array(z.object({ title: z.string().min(1), status: reviewStatus, conceptIds: z.array(z.string()) })),
  lessons: z.array(
    z.object({ subTopicTitle: z.string().min(1), title: z.string().min(1), status: reviewStatus, conceptIds: z.array(z.string()) }),
  ),
});

export type GoldenGraphFile = z.infer<typeof goldenGraphSchema>;
export type AliasEntry = z.infer<typeof aliasSchema>[number];
export type LinkFile = z.infer<typeof linkSchema>;
export type ReviewStatusValue = z.infer<typeof reviewStatus>;
export type AliasKindValue = z.infer<typeof aliasKind>;

export const parseGoldenGraph = (raw: unknown): GoldenGraphFile => goldenGraphSchema.parse(raw);
export const parseAliases = (raw: unknown): AliasEntry[] => aliasSchema.parse(raw);
export const parseLinks = (raw: unknown): LinkFile => linkSchema.parse(raw);

export interface ConceptRow {
  id: string;
  title: string;
  description: string | null;
  level: number;
  sortOrder: number;
  estimatedMinutes: number | null;
}

export interface PrerequisiteRow {
  conceptId: string;
  requiresId: string;
}

export interface AliasRow {
  id: string;
  scheme: string;
  alias: string;
  conceptId: string | null;
  kind: AliasKindValue;
  status: ReviewStatusValue;
  note: string | null;
}

export const conceptRows = (graph: GoldenGraphFile): ConceptRow[] =>
  graph.levels.flatMap((level) =>
    level.topics.map((topic, index) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description ?? null,
      level: level.id,
      sortOrder: index + 1,
      estimatedMinutes: topic.estimatedMinutes ?? null,
    })),
  );

export const prerequisiteRows = (graph: GoldenGraphFile): PrerequisiteRow[] =>
  graph.levels.flatMap((level) =>
    level.topics.flatMap((topic) => topic.prerequisites.map((requiresId) => ({ conceptId: topic.id, requiresId }))),
  );

export const aliasRows = (entries: AliasEntry[]): AliasRow[] =>
  entries.flatMap((entry) => {
    const targets: Array<string | null> = entry.targets.length > 0 ? entry.targets : [null];
    return targets.map((target) => ({
      id: `${entry.scheme}:${entry.alias}:${target ?? 'none'}`,
      scheme: entry.scheme,
      alias: entry.alias,
      conceptId: target,
      kind: entry.kind,
      status: entry.status,
      note: entry.note ?? null,
    }));
  });

const findCycle = (requires: Map<string, string[]>): string[] | null => {
  const done = new Set<string>();
  const walk = (id: string, path: string[]): string[] | null => {
    const at = path.indexOf(id);
    if (at >= 0) return [...path.slice(at), id];
    if (done.has(id)) return null;
    for (const next of requires.get(id) ?? []) {
      const cycle = walk(next, [...path, id]);
      if (cycle) return cycle;
    }
    done.add(id);
    return null;
  };
  for (const id of requires.keys()) {
    const cycle = walk(id, []);
    if (cycle) return cycle;
  }
  return null;
};

export interface ConceptSeedInput {
  graph: GoldenGraphFile;
  aliases: AliasEntry[];
  links: LinkFile;
}

export const validateConceptSeed = ({ graph, aliases, links }: ConceptSeedInput): string[] => {
  const issues: string[] = [];
  const ids = new Set<string>();
  const requires = new Map<string, string[]>();

  for (const level of graph.levels) {
    for (const topic of level.topics) {
      if (ids.has(topic.id)) issues.push(`duplicate concept id ${topic.id}`);
      ids.add(topic.id);
      requires.set(topic.id, topic.prerequisites);
    }
  }

  for (const [id, needed] of requires) {
    for (const requiredId of needed) {
      if (requiredId === id) issues.push(`${id} requires itself`);
      else if (!ids.has(requiredId)) issues.push(`${id} requires unknown concept ${requiredId}`);
    }
  }

  const cycle = findCycle(new Map([...requires].map(([id, needed]) => [id, needed.filter((n) => n !== id && ids.has(n))])));
  if (cycle) issues.push(`prerequisite cycle: ${cycle.join(' -> ')}`);

  const seenAliases = new Set<string>();
  for (const entry of aliases) {
    const key = `${entry.scheme}:${entry.alias}`;
    if (seenAliases.has(key)) issues.push(`alias ${entry.alias} is listed twice in ${entry.scheme}`);
    seenAliases.add(key);

    if (entry.kind === 'UNMATCHED') {
      if (entry.targets.length > 0) issues.push(`alias ${entry.alias} is UNMATCHED and must not have a target`);
      if (entry.status === 'APPROVED') issues.push(`alias ${entry.alias} is UNMATCHED and cannot be APPROVED`);
    } else if (entry.targets.length === 0) {
      issues.push(`alias ${entry.alias} of kind ${entry.kind} needs a target`);
    }
    for (const target of entry.targets) {
      if (!ids.has(target)) issues.push(`alias ${entry.alias} targets unknown concept ${target}`);
    }
  }

  const seenSubTopics = new Set<string>();
  for (const link of links.subTopics) {
    if (seenSubTopics.has(link.title)) issues.push(`sub-topic ${link.title} is linked twice`);
    seenSubTopics.add(link.title);
    if (link.conceptIds.length === 0) issues.push(`sub-topic link ${link.title} has no concept`);
    for (const conceptId of link.conceptIds) {
      if (!ids.has(conceptId)) issues.push(`sub-topic link ${link.title} targets unknown concept ${conceptId}`);
    }
  }

  const seenLessons = new Set<string>();
  for (const link of links.lessons) {
    const key = `${link.subTopicTitle} / ${link.title}`;
    if (seenLessons.has(key)) issues.push(`lesson ${key} is linked twice`);
    seenLessons.add(key);
    if (link.conceptIds.length === 0) issues.push(`lesson link ${key} has no concept`);
    for (const conceptId of link.conceptIds) {
      if (!ids.has(conceptId)) issues.push(`lesson link ${key} targets unknown concept ${conceptId}`);
    }
  }

  return issues;
};
