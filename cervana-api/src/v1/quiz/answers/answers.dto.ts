import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

// Base schema
export const baseAnswerSchema = z.object({
  attemptId: z.string().min(1, "Attempt ID is required").describe("Related quiz attempt ID"),
  questionId: z.string().min(1, "Question ID is required").describe("Related question ID"),
  userAnswer: z.any().describe("User submitted answer in JSON format"),
  isCorrect: z.boolean().describe("Whether the answer is correct"),
  pointsEarned: z.number().int().min(0).default(0).describe("Points earned for this answer"),
});

// Create DTO (single or array)
export const CreateAnswerDto = extendApi(
  z.union([baseAnswerSchema, z.array(baseAnswerSchema)]),
  {
    title: "CreateAnswerDto",
    example: [
      {
        attemptId: "uuid-attempt-1234",
        questionId: "uuid-question-5678",
        userAnswer: "Programming Language",
        isCorrect: true,
        pointsEarned: 5,
      },
      {
        attemptId: "uuid-attempt-9876",
        questionId: "uuid-question-4321",
        userAnswer: false,
        isCorrect: false,
        pointsEarned: 0,
      },
    ],
  }
);

export type CreateAnswerType = z.infer<typeof CreateAnswerDto>;

// Update DTO (opsional semua field)
export const UpdateAnswerDto = extendApi(
  baseAnswerSchema.partial(),
  {
    title: "UpdateAnswerDto",
    example: {
      userAnswer: "Updated Answer",
      isCorrect: true,
      pointsEarned: 10,
    },
  }
);

export type UpdateAnswerType = z.infer<typeof UpdateAnswerDto>;
