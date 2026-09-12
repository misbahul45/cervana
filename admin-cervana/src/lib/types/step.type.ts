import type { Lesson } from "./lesson.type";
import type { Quiz } from "./quiz.type";
import type { Chat } from "./chat.type";
import type { Resource } from "./resource.type";

export interface Step {
  id: string;
  title: string;
  description?: string;
  sortOrder: number;
  lessonId: string;
  lesson?: Lesson;
  quiz?: Quiz;
  chat?: Chat;
  resources?: Resource[];
  createdAt: Date;
  updatedAt: Date;
}
