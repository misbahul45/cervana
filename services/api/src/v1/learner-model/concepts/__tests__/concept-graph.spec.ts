import { ConceptView } from '../concept.types';
import { buildConceptGraph } from '../concept-graph';

const concept = (id: string, level: number, sortOrder: number, prerequisiteIds: string[] = []): ConceptView => ({
  id,
  title: id.toUpperCase(),
  description: null,
  level,
  sortOrder,
  estimatedMinutes: null,
  prerequisiteIds,
});

const concepts = [
  concept('c', 2, 1, ['a', 'b']),
  concept('b', 1, 2, ['a']),
  concept('a', 1, 1),
  concept('d', 2, 2, ['c']),
];

describe('concept graph', () => {
  const graph = buildConceptGraph(concepts);

  it('orders concepts by level then position, whatever order they arrive in', () => {
    expect(graph.order).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns the direct prerequisites of a concept', () => {
    expect(graph.prerequisitesOf('c')).toEqual(['a', 'b']);
    expect(graph.prerequisitesOf('a')).toEqual([]);
  });

  it('returns the transitive closure of the prerequisites without the concept itself and without duplicates', () => {
    expect(graph.closureOf('d')).toEqual(['a', 'b', 'c']);
    expect(graph.closureOf('b')).toEqual(['a']);
    expect(graph.closureOf('a')).toEqual([]);
  });

  it('knows an unknown id has no prerequisites and is not in the graph', () => {
    expect(graph.has('zzz')).toBe(false);
    expect(graph.prerequisitesOf('zzz')).toEqual([]);
    expect(graph.closureOf('zzz')).toEqual([]);
  });

  it('knows the level of a concept and null for an unknown one', () => {
    expect(graph.levelOf('a')).toBe(1);
    expect(graph.levelOf('d')).toBe(2);
    expect(graph.levelOf('zzz')).toBeNull();
  });

  it('ignores a prerequisite that is not an active concept in the graph', () => {
    const partial = buildConceptGraph([concept('x', 1, 1, ['retired']), concept('y', 1, 2, ['x'])]);

    expect(partial.prerequisitesOf('x')).toEqual([]);
    expect(partial.closureOf('y')).toEqual(['x']);
  });

  it('does not loop on a malformed cycle', () => {
    const cyclic = buildConceptGraph([concept('p', 1, 1, ['q']), concept('q', 1, 2, ['p'])]);

    expect(cyclic.closureOf('p')).toEqual(['q']);
  });
});
