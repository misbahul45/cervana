import type { ConceptMasteryEntry } from '~/interfaces/sandbox';

export interface MasterySummary {
  conceptsStarted: number;
  averagePercent: number;
  masteredCount: number;
}

export type MasteryTone = 'success' | 'primary' | 'warning';

export const toPercent = (score: number): number => Math.round(Math.min(1, Math.max(0, score)) * 100);

export const summarizeMastery = (entries: ConceptMasteryEntry[]): MasterySummary => {
  if (entries.length === 0) return { conceptsStarted: 0, averagePercent: 0, masteredCount: 0 };
  const mean = entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
  return {
    conceptsStarted: entries.length,
    averagePercent: toPercent(mean),
    masteredCount: entries.filter((entry) => entry.mastered).length,
  };
};

export const masteryTone = (entry: ConceptMasteryEntry): MasteryTone => (entry.mastered ? 'success' : entry.passed ? 'primary' : 'warning');

export const TONE_COLOR: Record<MasteryTone, string> = {
  success: 'var(--rc-success,#16a34a)',
  primary: 'var(--rc-primary,#3b82f6)',
  warning: 'var(--rc-warning,#f59e0b)',
};
