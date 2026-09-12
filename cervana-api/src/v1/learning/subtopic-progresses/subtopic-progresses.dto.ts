import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

export const baseSubTopicProgressSchema = z.object({
  userId: z.string().uuid("User ID must be a valid UUID").describe("Related User ID"),
  subTopicId: z.string().uuid("SubTopic ID must be a valid UUID").describe("Related SubTopic ID"),
  progress: z.number().min(0).max(100).default(0).describe("Progress percentage"),
  completed: z.boolean().default(false).describe("Completion status"),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"])
    .default("NOT_STARTED")
    .describe("Learning status"),
  quizId: z.string().uuid().optional().nullable().describe("Related Quiz ID"),
  startedAt: z.date().default(new Date()).describe("Start date and time"),
  completedAt: z.date().optional().nullable().describe("Completion date and time"),
});

export const CreateSubTopicProgressDto = extendApi(
  z.union([baseSubTopicProgressSchema, z.array(baseSubTopicProgressSchema)]),
  {
    title: "CreateSubTopicProgressDto",
    example: [
      {
        userId: "uuid-user-1234",
        subTopicId: "uuid-subtopic-5678",
        progress: 45.5,
        quizId: "uuid-quiz-1111",
        completed: false,
        status: "IN_PROGRESS",
        startedAt: "2025-10-23T09:00:00Z",
      },
      {
        userId: "uuid-user-9999",
        subTopicId: "uuid-subtopic-1111",
        progress: 100,
        completed: true,
        status: "COMPLETED",
        quizId: "uuid-quiz-1111",
        startedAt: "2025-10-20T09:00:00Z",
        completedAt: "2025-10-21T09:00:00Z",
      },
    ],
  }
);

export type CreateSubTopicProgressType = z.infer<typeof CreateSubTopicProgressDto>;

export const UpdateSubTopicProgressDto = extendApi(baseSubTopicProgressSchema.partial(), {
  title: "UpdateSubTopicProgressDto",
  example: {
    progress: 75.3,
    completed: false,
    status: "IN_PROGRESS",
  },
});

export type UpdateSubTopicProgressType = z.infer<typeof UpdateSubTopicProgressDto>;