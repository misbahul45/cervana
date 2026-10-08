import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../..');
const AUTHORIZED_WRITER = path.join('v1', 'payouts', 'payouts.service.ts');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === '__tests__' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });

const writers = (pattern: RegExp) =>
  sourceFiles(SRC_ROOT)
    .filter((file) => pattern.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(SRC_ROOT, file));

describe('payout money path has a single writer', () => {
  it('creates payout requests only inside PayoutsService', () => {
    expect(writers(/payoutRequest\s*\.\s*create\s*\(/)).toEqual([AUTHORIZED_WRITER]);
  });

  it('moves payout status only inside PayoutsService', () => {
    const updaters = writers(/payoutRequest\s*\.\s*(update|updateMany)\s*\(/);
    expect(updaters.filter((file) => file !== AUTHORIZED_WRITER)).toEqual([]);
  });

  it('exposes no legacy withdrawal controller', () => {
    const controllers = sourceFiles(SRC_ROOT).filter((file) => file.endsWith('.controller.ts'));
    const legacy = controllers.filter((file) => /@Controller\(\s*['"]commerce\/withdrawals['"]/.test(fs.readFileSync(file, 'utf8')));
    expect(legacy).toEqual([]);
  });
});
