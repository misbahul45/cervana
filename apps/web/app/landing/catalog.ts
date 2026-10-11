export interface CatalogTopic {
  readonly id: string;
  readonly prerequisites: readonly string[];
}

export interface CatalogLevel {
  readonly id: 1 | 2 | 3 | 4;
  readonly code: string;
  readonly topicCount: number;
  readonly entryPrerequisiteId: string | null;
  readonly sampleTopicIds: readonly string[];
}

export const LEVEL_ONE_TOPICS: readonly CatalogTopic[] = [
  { id: 'l1-t01-accounting-equation', prerequisites: [] },
  { id: 'l1-t02-debits-credits', prerequisites: ['l1-t01-accounting-equation'] },
  { id: 'l1-t03-journal-entries', prerequisites: ['l1-t02-debits-credits'] },
  { id: 'l1-t04-ledger-accounts', prerequisites: ['l1-t03-journal-entries'] },
  { id: 'l1-t05-trial-balance', prerequisites: ['l1-t04-ledger-accounts'] },
  { id: 'l1-t06-adjusting-entries', prerequisites: ['l1-t05-trial-balance'] },
  { id: 'l1-t07-closing-entries', prerequisites: ['l1-t06-adjusting-entries'] },
  { id: 'l1-t08-post-closing-trial-balance', prerequisites: ['l1-t07-closing-entries'] },
  { id: 'l1-t09-accounting-cycle', prerequisites: ['l1-t08-post-closing-trial-balance'] },
  { id: 'l1-t10-chart-of-accounts', prerequisites: ['l1-t01-accounting-equation'] },
  { id: 'l1-t11-cash-vs-accrual', prerequisites: ['l1-t01-accounting-equation'] },
  { id: 'l1-t12-source-documents', prerequisites: ['l1-t03-journal-entries'] },
  { id: 'l1-t13-double-entry-logic', prerequisites: ['l1-t02-debits-credits'] },
  { id: 'l1-t14-general-vs-special', prerequisites: ['l1-t03-journal-entries'] },
  { id: 'l1-t15-errors-and-corrections', prerequisites: ['l1-t05-trial-balance'] },
  { id: 'l1-t16-bank-reconciliation', prerequisites: ['l1-t05-trial-balance'] },
];

export const ACCOUNTING_LEVELS: readonly CatalogLevel[] = [
  {
    id: 1,
    code: 'ACC-L1',
    topicCount: 16,
    entryPrerequisiteId: null,
    sampleTopicIds: [
      'l1-t01-accounting-equation',
      'l1-t02-debits-credits',
      'l1-t03-journal-entries',
      'l1-t05-trial-balance',
    ],
  },
  {
    id: 2,
    code: 'ACC-L2',
    topicCount: 16,
    entryPrerequisiteId: 'l1-t09-accounting-cycle',
    sampleTopicIds: [
      'l2-t01-balance-sheet',
      'l2-t02-income-statement',
      'l2-t03-cash-flow-statement',
      'l2-t06-inventory-fifo',
    ],
  },
  {
    id: 3,
    code: 'ACC-L3',
    topicCount: 16,
    entryPrerequisiteId: 'l2-t02-income-statement',
    sampleTopicIds: [
      'l3-t01-cost-classification',
      'l3-t02-job-order-costing',
      'l3-t05-cvp-analysis',
      'l3-t08-budgeting-master-budget',
    ],
  },
  {
    id: 4,
    code: 'ACC-L4',
    topicCount: 17,
    entryPrerequisiteId: 'l2-t04-statement-of-changes-equity',
    sampleTopicIds: [
      'l4-t01-consolidated-statements',
      'l4-t07-deferred-taxes',
      'l4-t11-audit-objectives',
      'l4-t13-internal-controls',
    ],
  },
];

export const TOPIC_TOTAL = ACCOUNTING_LEVELS.reduce((sum, level) => sum + level.topicCount, 0);

export const SANDBOX_SCENARIO_COUNT = 7;

export const SIMULATOR_DAYS = [30, 60, 90] as const;

export const CREATOR_REQUIREMENTS = {
  coreConcepts: 3,
  sandboxScenarios: 5,
  minScorePercent: 80,
} as const;

export const DOMAIN_IDS = [
  'accounting',
  'programming',
  'mathematics',
  'science',
  'business',
  'design',
] as const;

export type DomainId = (typeof DOMAIN_IDS)[number];

export const ACTIVE_DOMAIN: DomainId = 'accounting';
