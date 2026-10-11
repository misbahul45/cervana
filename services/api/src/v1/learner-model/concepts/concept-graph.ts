import { ConceptView } from './concept.types';

export interface ConceptGraph {
  order: string[];
  has(id: string): boolean;
  prerequisitesOf(id: string): string[];
  closureOf(id: string): string[];
  levelOf(id: string): number | null;
}

export const buildConceptGraph = (concepts: ConceptView[]): ConceptGraph => {
  const ordered = [...concepts].sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);
  const order = ordered.map((c) => c.id);
  const known = new Set(order);
  const levels = new Map(ordered.map((c) => [c.id, c.level]));
  const requires = new Map(ordered.map((c) => [c.id, c.prerequisiteIds.filter((id) => known.has(id))]));

  const closureOf = (id: string): string[] => {
    const seen = new Set<string>();
    const visit = (current: string) => {
      for (const next of requires.get(current) ?? []) {
        if (next === id || seen.has(next)) continue;
        seen.add(next);
        visit(next);
      }
    };
    visit(id);
    return order.filter((candidate) => seen.has(candidate));
  };

  return {
    order,
    has: (id) => known.has(id),
    prerequisitesOf: (id) => requires.get(id) ?? [],
    closureOf,
    levelOf: (id) => levels.get(id) ?? null,
  };
};
