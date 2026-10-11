export type SandboxDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface SandboxScenario {
  id: string;
  title: string;
  description: string;
  difficulty: SandboxDifficulty;
  level: 1 | 2 | 3 | 4;
  topicId: string;
}

export interface SandboxJournalEntry {
  debitAccount: string;
  creditAccount: string;
  amount: number;
}

export interface SandboxJournalValidation {
  isBalanced: boolean;
  score?: number;
  errors?: Array<{ code: string; message: string }>;
  scenario?: { id: string; title: string; level: number };
}

export interface SandboxGraphLevel {
  id: number;
  title: string;
  topics: SandboxGraphTopic[];
}

export interface SandboxGraphTopic {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  prerequisites: string[];
}

export interface SandboxGraph {
  levels: SandboxGraphLevel[];
}

export interface DiagnosticQuestion {
  id: string;
  level: number;
  prompt: string;
  options: string[];
}

export interface PlacementResult {
  recommendedLevel: number;
  recommendedTopicId: string;
  confidence: number;
}

export interface ConceptMasteryEntry {
  conceptId: string;
  title: string;
  level: number;
  score: number;
  confidence: number;
  evidenceCount: number;
  lastEventAt: string | null;
  passed: boolean;
  mastered: boolean;
}

export interface MisconceptionPattern {
  topicId?: string;
  conceptKey: string;
  patternCode?: string;
  confidence?: number;
  count?: number;
}

export interface NextActivityDecision {
  topicId: string;
  level: number;
  rationaleKind: 'no_exploration' | 'remediation' | 'progression';
}

