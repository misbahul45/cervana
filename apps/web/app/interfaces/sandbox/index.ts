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

export interface MasteryScore {
  topicId: string;
  score: number;
  attempts: number;
  evidenceCount?: number;
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

export interface UserAchievement {
  id: string;
  achievementId: string;
  awardedAt: string;
  achievement: {
    id: string;
    title: string;
    description?: string;
    icon?: string;
  };
}

export interface SkillNodeRecord {
  id: string;
  topicId: string;
  state: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED';
  progress: number;
}

export interface LevelInfo {
  level: number;
  xp: number;
}