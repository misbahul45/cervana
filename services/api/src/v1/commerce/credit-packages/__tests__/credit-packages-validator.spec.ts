import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const PATH = join(REPO_ROOT, 'prisma', 'seed-data', 'credit-packages.json');

describe('credit-packages.json (Phase 5)', () => {
  const pkgs = JSON.parse(readFileSync(PATH, 'utf-8'));

  it('has at least 3 packages', () => {
    expect(pkgs.length).toBeGreaterThanOrEqual(3);
  });

  it('every package has positive creditAmount and priceAmount', () => {
    for (const p of pkgs) {
      expect(p.creditAmount).toBeGreaterThan(0);
      expect(p.priceAmount).toBeGreaterThan(0);
    }
  });

  it('slugs are unique', () => {
    const slugs = pkgs.map((p: { slug: string }) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});