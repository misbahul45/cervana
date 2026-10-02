import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { SandboxController } from '../sandbox.controller';
import { AccountingSandboxService } from '../accounting-sandbox.service';
import { GoldenScenarioProvider } from '../golden-scenarios.provider';
import { GOLDEN_SCENARIOS } from '../golden-scenarios.provider';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { RolesGuard } from '@/v1/auth/guards/roles.guard';
import { OwnershipGuard } from '@/v1/common/guards/ownership.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const mockScenarios = [
  {
    id: 's-buy-inventory-100',
    topicId: 'l1-t03-journal-entries',
    level: 1,
    title: 'Buy inventory for $100 cash',
    description: 'desc',
    difficulty: 'BEGINNER',
    expectedLines: [
      { accountId: 'Inventory', side: 'DEBIT', amount: 100 },
      { accountId: 'Cash', side: 'CREDIT', amount: 100 },
    ],
  },
];

const mockGraph = {
  levels: [
    {
      id: 1,
      title: 'Fundamentals',
      topics: [
        {
          id: 'l1-t03-journal-entries',
          title: 'Journal Entries',
          description: 'Recording journal entries',
          estimatedMinutes: 60,
          prerequisites: [],
        },
      ],
    },
  ],
};

class StubPrismaService {}

describe('SandboxController (Phase 1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SandboxController],
      providers: [
        AccountingSandboxService,
        {
          provide: GoldenScenarioProvider,
          useValue: {
            list: (filter?: { level?: number; topicId?: string }) =>
              mockScenarios.filter((scenario) => {
                if (filter?.level !== undefined && scenario.level !== filter.level) return false;
                if (filter?.topicId !== undefined && scenario.topicId !== filter.topicId) return false;
                return true;
              }),
            findById: (id: string) => mockScenarios.find((scenario) => scenario.id === id),
            getGraph: () => mockGraph,
          },
        },
        { provide: GOLDEN_SCENARIOS, useValue: mockScenarios },
        { provide: PrismaService, useClass: StubPrismaService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OwnershipGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /v1/sandbox/scenarios returns the scenario list', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sandbox/scenarios');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 's-buy-inventory-100', level: 1 });
  });

  it('GET /v1/sandbox/scenarios filters by level', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sandbox/scenarios').query({ level: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('POST /v1/sandbox/journal/validate rejects unbalanced lines', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/sandbox/journal/validate')
      .send({
        lines: [
          { accountId: 'Inventory', side: 'DEBIT', amount: 100 },
          { accountId: 'Cash', side: 'CREDIT', amount: 50 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.isBalanced).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('POST /v1/sandbox/journal/validate accepts balanced entry with scenario', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/sandbox/journal/validate')
      .send({
        scenarioId: 's-buy-inventory-100',
        entries: [{ debitAccount: 'Inventory', creditAccount: 'Cash', amount: 100 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.isBalanced).toBe(true);
    expect(res.body.score).toBeGreaterThan(0);
  });

  it('POST /v1/sandbox/journal/validate returns score 0 for non-matching scenario entries', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/sandbox/journal/validate')
      .send({
        scenarioId: 's-buy-inventory-100',
        entries: [{ debitAccount: 'Cash', creditAccount: 'Inventory', amount: 100 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.isBalanced).toBe(true);
    expect(res.body.score).toBe(0);
  });

  it('POST /v1/sandbox/journal/validate rejects unknown scenario', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/sandbox/journal/validate')
      .send({
        scenarioId: 'does-not-exist',
        entries: [{ debitAccount: 'Inventory', creditAccount: 'Cash', amount: 100 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.isBalanced).toBe(false);
  });
});