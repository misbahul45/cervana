import * as fs from 'fs';
import * as path from 'path';
import {
  aliasRows,
  conceptRows,
  parseAliases,
  parseGoldenGraph,
  parseLinks,
  validateConceptSeed,
} from '../concept-seed';

const seedDir = path.resolve(__dirname, '../../../../../prisma/seed-data');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(seedDir, name), 'utf8'));

const graph = parseGoldenGraph(read('golden-accounting-graph.json'));
const aliases = parseAliases(read('concept-aliases.json'));
const links = parseLinks(read('concept-curriculum-links.json'));

const pythonTaxonomy = path.resolve(__dirname, '../../../../../../ai-api/v1/domain/data/default_taxonomy.py');
const describeWithTaxonomy = fs.existsSync(pythonTaxonomy) ? describe : describe.skip;

describe('reviewed seed data', () => {
  it('keeps the 65 golden concepts', () => {
    expect(conceptRows(graph)).toHaveLength(65);
  });

  it('is consistent: unique ids, known prerequisites, no cycle, known targets', () => {
    expect(validateConceptSeed({ graph, aliases, links })).toEqual([]);
  });

  it('writes one alias row per mapping target', () => {
    const rows = aliasRows(aliases);

    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});

describeWithTaxonomy('python domain ids', () => {
  const ids = [...fs.readFileSync(pythonTaxonomy, 'utf8').matchAll(/_concept\(\s*"([a-z_]+)"/g)].map((m) => m[1]);

  it('reads the ids of the python taxonomy', () => {
    expect(ids.length).toBeGreaterThanOrEqual(10);
  });

  it('has an alias entry for every python concept id, so an unmapped concept fails here', () => {
    const mapped = new Set(aliases.filter((a) => a.scheme === 'PYTHON_DOMAIN').map((a) => a.alias));

    expect(ids.filter((id) => !mapped.has(id))).toEqual([]);
  });
});
