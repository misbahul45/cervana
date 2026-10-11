export interface ConceptView {
  id: string;
  title: string;
  description: string | null;
  level: number;
  sortOrder: number;
  estimatedMinutes: number | null;
  prerequisiteIds: string[];
}

export interface CurriculumReference {
  lessonId: string | null;
  subTopicId: string | null;
}

export type ConceptSource = 'LESSON' | 'SUBTOPIC' | 'NONE';

export interface CurriculumConcepts {
  source: ConceptSource;
  conceptIds: string[];
}
