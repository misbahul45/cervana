import z from 'zod';
import { extendApi } from '@anatine/zod-openapi';

export const baseStepSchema = z.object({
  title: z.string().min(1, "Step title is required").describe("Step title"),
  description: z.string().optional().describe("Optional step description"),
  sortOrder: z.number().default(0).describe("Sort order for display"),
  lessonId: z.string().min(1, "Lesson ID is required").describe("Related lesson ID"),
  themeId: z.string().min(1, "Step Theme ID is required").describe("Related step theme ID"), 
});

export const CreateStepDto = extendApi(
  baseStepSchema,
  {
    title: 'CreateStepDto',
    example: {
      title: 'Step 1: Declaring Variables',
      description: 'Understand how to declare variables in JavaScript',
      sortOrder: 1,
      lessonId: 'uuid-lesson-5678',
      themeId: 'uuid-step-theme-1234', 
    },
  }
);

export type CreateStepType = z.infer<typeof CreateStepDto>;

export const UpdateStepDto = extendApi(
  baseStepSchema.partial(),
  {
    title: 'UpdateStepDto',
    example: {
      title: 'Updated Step Title',
      description: 'Updated step description',
      sortOrder: 3,
      themeId: 'uuid-step-theme-4321', 
    },
  }
);

export type UpdateStepType = z.infer<typeof UpdateStepDto>;
