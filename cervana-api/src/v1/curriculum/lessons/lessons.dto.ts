import z from 'zod';
import { extendApi } from '@anatine/zod-openapi';


export const baseLessonSchema = z.object({
  title: z.string().min(1, "Lesson title is required").describe("Lesson title"),
  description: z
    .string()
    .optional()
    .describe("Optional lesson description"),
  sortOrder: z.number().default(0).describe("Sort order for display"),
  subTopicId: z
    .string()
    .min(1, "SubTopic ID is required")
    .describe("Related subTopic ID"),
  themeId: z.string().min(1, "Lesson Theme ID is required").describe("Related lesson theme ID"), 
});

export const CreateLessonDto = extendApi(
  baseLessonSchema,
  {
    title: 'CreateLessonDto',
    example: {
      title: 'Introduction to Variables',
      description: 'Learn about variables in programming',
      sortOrder: 1,
      subTopicId: 'uuid-subtopic-1234',
      themeId: 'uuid-lesson-theme-5678', 
    },
  }
);

export type CreateLessonType = z.infer<typeof CreateLessonDto>;


export const UpdateLessonDto = extendApi(
  baseLessonSchema.partial(),
  {
    title: 'UpdateLessonDto',
    example: {
      title: 'Updated Lesson Title',
      description: 'Updated lesson description',
      sortOrder: 2,
      themeId: 'uuid-lesson-theme-9876',
    },
  }
);

export type UpdateLessonType = z.infer<typeof UpdateLessonDto>;
