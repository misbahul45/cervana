export interface QuizAccessActor {
  id: string;
  role: string;
}

export interface QuizAccessFacts {
  exists: boolean;
  progressOwnerIds: string[];
  topicId: string | null;
}

export type QuizAccess = 'allow' | 'not-found' | 'not-owner' | 'not-enrolled';

const AUTHORS = new Set(['ADMIN', 'TEACHER']);

export const decideQuizAccess = (actor: QuizAccessActor, facts: QuizAccessFacts, enrolledInTopic: boolean): QuizAccess => {
  if (!facts.exists) return 'not-found';
  if (AUTHORS.has(actor.role)) return 'allow';
  if (facts.progressOwnerIds.length > 0) return facts.progressOwnerIds.includes(actor.id) ? 'allow' : 'not-owner';
  if (facts.topicId === null) return 'not-enrolled';
  return enrolledInTopic ? 'allow' : 'not-enrolled';
};
