import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { SandboxGraph, SandboxScenario } from './dto/sandbox.dto';

export const GOLDEN_SCENARIOS = Symbol('GOLDEN_SCENARIOS');
export const GOLDEN_GRAPH = Symbol('GOLDEN_GRAPH');

const SCENARIO_PATHS = [
  join(process.cwd(), 'prisma', 'seed-data', 'golden-scenarios.json'),
  join(__dirname, '..', '..', '..', 'prisma', 'seed-data', 'golden-scenarios.json'),
];

const GRAPH_PATHS = [
  join(process.cwd(), 'prisma', 'seed-data', 'golden-accounting-graph.json'),
  join(__dirname, '..', '..', '..', 'prisma', 'seed-data', 'golden-accounting-graph.json'),
];

function loadJson<T>(paths: string[], label: string, fallback: T): T {
  for (const path of paths) {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf-8')) as T;
      } catch (err) {
        const logger = new Logger('GoldenScenarioProvider');
        logger.warn(`Failed to parse ${label} at ${path}: ${(err as Error).message}`);
      }
    }
  }
  return fallback;
}

@Injectable()
export class GoldenScenarioProvider {
  private readonly scenarios: SandboxScenario[];
  private readonly graph: SandboxGraph;

  constructor() {
    this.scenarios = loadJson<SandboxScenario[]>(SCENARIO_PATHS, 'golden-scenarios.json', []);
    this.graph = loadJson<SandboxGraph>(GRAPH_PATHS, 'golden-accounting-graph.json', { levels: [] });
  }

  list(filter?: { level?: number; topicId?: string }): SandboxScenario[] {
    return this.scenarios.filter((scenario) => {
      if (filter?.level !== undefined && scenario.level !== filter.level) return false;
      if (filter?.topicId !== undefined && scenario.topicId !== filter.topicId) return false;
      return true;
    });
  }

  findById(id: string): SandboxScenario | undefined {
    return this.scenarios.find((scenario) => scenario.id === id);
  }

  getGraph(): SandboxGraph {
    return this.graph;
  }
}