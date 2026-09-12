export interface LessonProgress {
  id: string;
  lessonId: string;
  userId: string;
  isDone: boolean;
  percentage: number;
}

export interface StepProgress {
  id: string;
  stepId: string;
  userId: string;
  isDone: boolean;
}

export interface SubTopicProgress {
  id: string;
  userId: string;
  subTopicId: string;
  progress: number;
  completed: boolean;
}
