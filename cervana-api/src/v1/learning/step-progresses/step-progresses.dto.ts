import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

export const baseStepProgressSchema = z.object({
  userId: z.string().uuid("User ID must be a valid UUID").describe("Related User ID"),
  stepId: z.string().uuid("Step ID must be a valid UUID").describe("Related Step ID"),

  quizId: z.string().uuid().optional().nullable().describe("Related Quiz ID"),

  progress: z.number().min(0).max(100).default(0).describe("Progress percentage"),
  isDone: z.boolean().default(false).describe("Completion status"),

  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"])
    .default("NOT_STARTED")
    .describe("Learning status"),

  startedAt: z.date().default(new Date()).describe("Start date and time"),
  completedAt: z.date().optional().nullable().describe("Completion date and time"),
});



export const CreateStepProgressDto = extendApi(
  z.union([baseStepProgressSchema, z.array(baseStepProgressSchema)]),
  {
    title: "CreateStepProgressDto",
    example: [
      {
        userId: "uuid-user-1234",
        stepId: "uuid-step-5678",
        progress: 50,
        quizId: "uuid-quiz-1111",
        isDone: false,
        status: "IN_PROGRESS",
        startedAt: "2025-10-23T09:00:00Z",
      },
      {
        userId: "uuid-user-9999",
        stepId: "uuid-step-8888",
        progress: 100,
        isDone: true,
        status: "COMPLETED",
        quizId: "uuid-quiz-1111",
        startedAt: "2025-10-20T09:00:00Z",
        completedAt: "2025-10-21T09:00:00Z",
      },
    ],
  }
);

export type CreateStepProgressType = z.infer<typeof CreateStepProgressDto>;


export const UpdateStepProgressDto = extendApi(
  baseStepProgressSchema.partial(),
  {
    title: "UpdateStepProgressDto",
    example: {
      progress: 75,
      isDone: false,
      status: "IN_PROGRESS",
    },
  }
);

export type UpdateStepProgressType = z.infer<typeof UpdateStepProgressDto>;
