import z from "zod";
import { extendApi } from "@anatine/zod-openapi";
import { AttemptStatus } from "@prisma/client";

// Enum AttemptStatus sesuai model Prisma
export const AttemptStatusEnum = z.enum(AttemptStatus).describe("Status of the quiz attempt");

// Base schema
export const baseQuizAttemptSchema = z.object({
  userId: z.string().min(1, "User ID is required").describe("User ID who attempts the quiz"),
  quizId: z.string().min(1, "Quiz ID is required").describe("Related quiz ID"),
  score: z.number().min(0).max(100).optional().describe("Score achieved in the attempt (0-100)"),
  status: AttemptStatusEnum.default("IN_PROGRESS"),
  attemptNumber: z.number().int().min(1).default(1).describe("Attempt count for this user on the quiz"),
});

// Create DTO (single or array)
export const CreateQuizAttemptDto = extendApi(
  z.union([baseQuizAttemptSchema, z.array(baseQuizAttemptSchema)]),
  {
    title: "CreateQuizAttemptDto",
    example: [
      {
        userId: "uuid-user-1234",
        quizId: "uuid-quiz-5678",
        score: 85,
        status: "COMPLETED",
        attemptNumber: 1,
      },
      {
        userId: "uuid-user-9876",
        quizId: "uuid-quiz-4321",
        status: "IN_PROGRESS",
        attemptNumber: 2,
      },
    ],
  }
);

export type CreateQuizAttemptType = z.infer<typeof CreateQuizAttemptDto>;

// Update DTO (opsional semua field)
export const UpdateQuizAttemptDto = extendApi(
  baseQuizAttemptSchema.partial(),
  {
    title: "UpdateQuizAttemptDto",
    example: {
      score: 90,
      status: "COMPLETED",
    },
  }
);

export type UpdateQuizAttemptType = z.infer<typeof UpdateQuizAttemptDto>;
