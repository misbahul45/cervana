import z from "zod";
import { extendApi } from "@anatine/zod-openapi";import { LearningStatus } from "@prisma/client";
;

// Enums sesuai Prisma
export const TopicAccessTypeEnum = z.enum(["FREE", "PURCHASED"]).describe("Access type of the topic");
export const LearningStatusEnum = z.enum(LearningStatus).describe("Learning status of the topic");

// Base schema
export const baseUserTopicSchema = z.object({
  userId: z.string().min(1, "User ID is required").describe("User ID who enrolled in the topic"),
  topicId: z.string().min(1, "Topic ID is required").describe("Topic ID the user enrolled in"),
  accessType: TopicAccessTypeEnum.default("FREE"),
  status: LearningStatusEnum.default("NOT_STARTED"),
  quizId: z.string().uuid().optional().nullable().describe("Related Quiz ID"),
  
  progressPercent: z.number().int().min(0).max(100).default(0).describe("Progress percentage of the topic (0-100)"),
  purchasedAt:z.preprocess(
      (val) => (typeof val === "string" ? new Date(val) : val),
      z.date().optional()
    ).describe("Datetime when the topic was purchased"),
  expiredAt: z.preprocess(
      (val) => (typeof val === "string" ? new Date(val) : val),
      z.date().optional()
    ).describe("Datetime when the topic access will expire"),
});

// Create DTO (single or array)
export const CreateUserTopicDto = extendApi(
  z.union([baseUserTopicSchema, z.array(baseUserTopicSchema)]),
  {
    title: "CreateUserTopicDto",
    example: [
      {
        userId: "uuid-user-1234",
        topicId: "uuid-topic-5678",
        accessType: "FREE",
        quizId: "uuid-quiz-1111",
        status: "NOT_STARTED",
        progressPercent: 0,
      },
      {
        userId: "uuid-user-9876",
        topicId: "uuid-topic-4321",
        accessType: "PAID",
        status: "IN_PROGRESS",
        progressPercent: 45,
        quizId: "uuid-quiz-1111",
        purchasedAt: "2025-08-21T10:00:00.000Z",
        expiredAt: "2025-12-21T10:00:00.000Z",
      },
    ],
  }
);

export type CreateUserTopicType = z.infer<typeof CreateUserTopicDto>;

// Update DTO (opsional semua field)
export const UpdateUserTopicDto = extendApi(
  baseUserTopicSchema.partial(),
  {
    title: "UpdateUserTopicDto",
    example: {
      status: "COMPLETED",
      progressPercent: 100,
    },
  }
);

export type UpdateUserTopicType = z.infer<typeof UpdateUserTopicDto>;
