import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

export const baseLessonProgressSchema = z.object({
  userId: z
    .string()
    .min(1, "User ID is required")
    .describe("User ID who is progressing in the lesson"),

  lessonId: z
    .string()
    .min(1, "Lesson ID is required")
    .describe("Lesson ID being progressed"),

  quizId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .describe("Related Quiz ID"),

  introduction: z
    .string()
    .optional()
    .nullable()
    .describe("Some introduction data for the lesson progress"),

  isDone: z
    .boolean()
    .optional()
    .describe("Whether the lesson is finished"),

  percentage: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Percentage of lesson progress"),
});

export const CreateLessonProgressDto = extendApi(
  z.union([baseLessonProgressSchema, z.array(baseLessonProgressSchema)]),
  {
    title: "CreateLessonProgressDto",
    example: [
      {
        userId: "uuid-user-1234",
        lessonId: "uuid-lesson-5678",
        quizId: "uuid-quiz-1111",
        introduction: "Starting the lesson...",
        isDone: false,
        percentage: 20,
      },
      {
        userId: "uuid-user-9876",
        lessonId: "uuid-lesson-4321",
        quizId: "uuid-quiz-2222",
        isDone: true,
        percentage: 100,
      },
    ],
  }
);

export type CreateLessonProgressType = z.infer<typeof CreateLessonProgressDto>;

export const UpdateLessonProgressDto = extendApi(
  baseLessonProgressSchema.partial(),
  {
    title: "UpdateLessonProgressDto",
    example: {
      isDone: true,
      percentage: 100,
    },
  }
);

export type UpdateLessonProgressType = z.infer<typeof UpdateLessonProgressDto>;
