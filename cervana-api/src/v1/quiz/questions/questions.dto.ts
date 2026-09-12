import z from "zod";
import { extendApi } from "@anatine/zod-openapi";
import { QuestionType } from "@prisma/client";

// Enum QuestionType sesuai Prisma
export const QuestionTypeEnum = z.enum(QuestionType).describe("Type of the question");

// Schema image fleksibel
const imageSchema = z.union([
  z.string().url(),
  z.object({ fileId: z.string().min(1), url: z.string().url().optional() }),
]);

// Schema option untuk multiple choice
const optionSchema = z.object({
  text: z.string().min(1).describe("Option text (rich editor HTML/JSON)"),
  image: imageSchema.optional().describe("Optional image for this option"),
});

// Base schema
export const baseQuestionSchema = z.object({
  quizId: z.string().uuid().describe("Related quiz ID"),
  question: z.string().min(1).describe("Question text (rich editor HTML/JSON)"),
  questionImage: imageSchema.optional().describe("Optional question image"),
  questionType: QuestionTypeEnum.default("MULTIPLE_CHOICE"),
  options: z.array(optionSchema).optional().describe("Available options for multiple choice"),
  correctAnswer: z.any().describe("Correct answer (array for MCQ, boolean for True/False, string/json for Essay)"),
  points: z.number().int().min(0).default(1).describe("Points awarded for this question"),
  sortOrder: z.number().int().min(0).default(0).describe("Order of the question in the quiz"),
});

// Create DTO (single or array)
export const CreateQuestionDto = extendApi(
  z.union([baseQuestionSchema, z.array(baseQuestionSchema)]),
  {
    title: "CreateQuestionDto",
    example: [
      {
        quizId: "uuid-quiz-1234",
        question: "<p>What is JavaScript?</p>",
        questionImage: { fileId: "qImg123", url: "https://example.com/js.png" },
        questionType: "MULTIPLE_CHOICE",
        options: [
          { text: "<p>Programming Language</p>", image: "https://example.com/option1.png" },
          { text: "<p>Database</p>" },
          { text: "<p>Operating System</p>" },
        ],
        correctAnswer: [{ text: "<p>Programming Language</p>" }],
        points: 5,
        sortOrder: 1,
      },
      {
        quizId: "uuid-quiz-5678",
        question: "<p>TypeScript is a superset of JavaScript. (True/False)</p>",
        questionType: "TRUE_FALSE",
        correctAnswer: true,
        points: 2,
        sortOrder: 2,
      },
    ],
  }
);

export type CreateQuestionType = z.infer<typeof CreateQuestionDto>;

// Update DTO (opsional semua field)
export const UpdateQuestionDto = extendApi(
  baseQuestionSchema.partial(),
  {
    title: "UpdateQuestionDto",
    example: {
      question: "<p>Updated question text</p>",
      questionImage: "https://example.com/newquestion.png",
      points: 10,
    },
  }
);

export type UpdateQuestionType = z.infer<typeof UpdateQuestionDto>;
