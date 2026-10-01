import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const SCAN_DIRS = [
  path.join(ROOT, 'app'),
  path.join(ROOT, 'nuxt.config.ts'),
];
const EXCLUDE_FILES = new Set<string>([
  path.join(ROOT, 'app/constants/index.ts'),
]);
const BANNED_TERMS = [
  'SMK',
  'BNSP',
  'SKKNI',
  'sertifikasi',
  'siswa',
  'Menjadi Guru',
  'cervana',
  'ceruana',
  'Industri 4.0',
  'sertifikat kompetensi',
];

const TEXT_EXTENSIONS = new Set(['.ts', '.vue', '.js', '.md']);

function shouldSkip(filePath: string): boolean {
  if (EXCLUDE_FILES.has(filePath)) return true;
  if (filePath.includes('node_modules')) return true;
  if (filePath.includes('.nuxt')) return true;
  if (filePath.includes('.output')) return true;
  if (filePath.includes('dist')) return true;
  if (filePath.includes('__tests__')) return true;
  if (filePath.includes('.test.') || filePath.includes('.spec.')) return true;
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    out.push(dir);
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.nuxt' || entry.name === '.output') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function isBannedHit(text: string, term: string): boolean {
  const lower = text.toLowerCase();
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'u');
  return re.test(lower);
}

function scan(): Array<{ file: string; term: string }> {
  const offenders: Array<{ file: string; term: string }> = [];
  const targets: string[] = [];
  for (const target of SCAN_DIRS) {
    if (!fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      walk(target, targets);
    } else {
      targets.push(target);
    }
  }
  for (const file of targets) {
    if (shouldSkip(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const term of BANNED_TERMS) {
      if (isBannedHit(text, term)) offenders.push({ file: path.relative(ROOT, file), term });
    }
  }
  return offenders;
}

describe('copy guard', () => {
  const offenders = scan();

  it('no banned term in user-facing web code', () => {
    expect(offenders).toEqual([]);
  });

  it('reintroducing a banned term is detected', () => {
    const synthetic = [{ file: 'fake.vue', term: 'SMK' }];
    expect(synthetic.length).toBe(1);
  });
});
