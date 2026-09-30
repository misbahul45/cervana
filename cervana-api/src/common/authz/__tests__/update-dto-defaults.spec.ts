import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../..');

const dtoFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : dtoFiles(full);
    return /dto\.ts$/i.test(entry.name) ? [full] : [];
  });

describe('update DTOs', () => {
  const offenders: string[] = [];
  let inspected = 0;

  for (const file of dtoFiles(SRC_ROOT)) {
    const mod = require(file);
    for (const [name, schema] of Object.entries<any>(mod)) {
      if (!/^Update.*Dto$/.test(name) || typeof schema?.safeParse !== 'function') continue;
      inspected += 1;
      const result = schema.safeParse({});
      if (!result.success) continue;
      const data = result.data;
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        offenders.push(`${path.relative(SRC_ROOT, file)}::${name} -> ${Object.keys(data).join(',')}`);
      }
    }
  }

  it('inspects the update DTOs', () => {
    expect(inspected).toBeGreaterThan(10);
  });

  it('an empty update never injects default values', () => {
    expect(offenders).toEqual([]);
  });
});
