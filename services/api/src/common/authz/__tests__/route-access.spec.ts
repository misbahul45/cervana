import 'reflect-metadata';

jest.mock('@arcjet/nest', () => ({
  ARCJET: 'ARCJET',
  fixedWindow: jest.fn(),
  shield: jest.fn(),
  ArcjetModule: { forRoot: jest.fn() },
}));

import * as fs from 'fs';
import * as path from 'path';
import { IS_PUBLIC_KEY, ROLES_KEY } from '@/v1/auth/auth.decorator';
import { OWNERSHIP_KEY } from '@/v1/common/guards/ownership.guard';
import { ACCESS_KEY } from '../access';

const SRC_ROOT = path.resolve(__dirname, '../../..');

const controllerFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : controllerFiles(full);
    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });

const DECISION_KEYS = [IS_PUBLIC_KEY, ROLES_KEY, OWNERSHIP_KEY, ACCESS_KEY];

const hasDecision = (target: object, handler: object) =>
  DECISION_KEYS.some((key) => {
    const value = Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, target);
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });

const collectRoutes = () => {
  const routes: Array<{ controller: string; handler: string; decided: boolean }> = [];
  for (const file of controllerFiles(SRC_ROOT)) {
    const mod = require(file);
    for (const exported of Object.values(mod) as any[]) {
      if (typeof exported !== 'function') continue;
      if (Reflect.getMetadata('path', exported) === undefined) continue;
      for (const name of Object.getOwnPropertyNames(exported.prototype)) {
        if (name === 'constructor') continue;
        const handler = exported.prototype[name];
        if (typeof handler !== 'function') continue;
        if (Reflect.getMetadata('method', handler) === undefined) continue;
        routes.push({
          controller: `${path.relative(SRC_ROOT, file)}::${exported.name}`,
          handler: name,
          decided: hasDecision(exported, handler),
        });
      }
    }
  }
  return routes;
};

describe('route access decisions', () => {
  const routes = collectRoutes();

  it('discovers controllers and routes', () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it('every route declares an explicit access decision', () => {
    const undecided = routes
      .filter((r) => !r.decided)
      .map((r) => `${r.controller}.${r.handler}`);
    expect(undecided).toEqual([]);
  });
});
