import { LEVEL_ONE_TOPICS, type CatalogTopic } from './catalog';
import { MASTERY_THRESHOLD, type NextTopicDecision } from './policy';

export type NodeState = 'mastered' | 'recovery' | 'next' | 'available' | 'locked';

export interface GraphNode {
  readonly id: string;
  readonly depth: number;
  readonly x: number;
  readonly y: number;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
}

export interface GraphLayout {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly columns: number;
}

function depthOf(topic: CatalogTopic, byId: ReadonlyMap<string, CatalogTopic>, memo: Map<string, number>): number {
  const known = memo.get(topic.id);
  if (known !== undefined) return known;
  const depth =
    topic.prerequisites.length === 0
      ? 0
      : 1 + Math.max(...topic.prerequisites.map((id) => depthOf(byId.get(id)!, byId, memo)));
  memo.set(topic.id, depth);
  return depth;
}

export function layoutGraph(topics: readonly CatalogTopic[] = LEVEL_ONE_TOPICS): GraphLayout {
  const byId = new Map(topics.map((topic) => [topic.id, topic] as const));
  const memo = new Map<string, number>();
  const depths = topics.map((topic) => ({ topic, depth: depthOf(topic, byId, memo) }));
  const maxDepth = Math.max(...depths.map((entry) => entry.depth));

  const columns = new Map<number, CatalogTopic[]>();
  for (const { topic, depth } of depths) {
    const column = columns.get(depth) ?? [];
    column.push(topic);
    columns.set(depth, column);
  }

  const nodes: GraphNode[] = [];
  for (const [depth, column] of columns) {
    column.forEach((topic, lane) => {
      const spread = (lane - (column.length - 1) / 2) * 0.3;
      nodes.push({
        id: topic.id,
        depth,
        x: maxDepth === 0 ? 0.5 : depth / maxDepth,
        y: 0.5 + spread,
      });
    });
  }

  const edges: GraphEdge[] = topics.flatMap((topic) =>
    topic.prerequisites.map((from) => ({ from, to: topic.id })),
  );

  return { nodes, edges, columns: maxDepth + 1 };
}

export function nodeStates(
  mastery: Readonly<Record<string, number>>,
  decision: NextTopicDecision,
  topics: readonly CatalogTopic[] = LEVEL_ONE_TOPICS,
): Record<string, NodeState> {
  const states: Record<string, NodeState> = {};
  for (const topic of topics) {
    const score = mastery[topic.id] ?? 0;
    const prerequisitesMet = topic.prerequisites.every((id) => (mastery[id] ?? 0) >= MASTERY_THRESHOLD);
    if (topic.id === decision.topicId && decision.rationaleKind === 'remediation') states[topic.id] = 'recovery';
    else if (topic.id === decision.topicId) states[topic.id] = 'next';
    else if (score >= MASTERY_THRESHOLD) states[topic.id] = 'mastered';
    else if (prerequisitesMet) states[topic.id] = 'available';
    else states[topic.id] = 'locked';
  }
  return states;
}
