import { z } from 'zod'
import { extendApi } from '@anatine/zod-openapi'

const PersonalityQuizQuestionSchema = z.object({
  question: z.string(),
  type: z.enum(
    ["multiple_choice", "input", "matching", "scenario"] as const
  ),
  difficulty: z.enum(
    ["easy", "medium", "hard", "hots"] as const
  ),
  options: z.array(z.string()).optional().nullable(),
  answer: z.string().nullable().optional()
})

export const PersonalityQuizUserAttemptSchema = z.array(
  z.object({
    question: z.string(),
    userAnswer: z.string(),
    answer: z.string().nullable().optional()
  })
)

export const PersonalityQuizResultSchema = z.object({
  scores: z.record(z.string(), z.number()).optional(),
  level: z.enum(
    ["beginner", "intermediate", "advanced", "expert"] as const
  ).optional(),
})

const basePersonalityQuizSchema = z.object({
  userId: z.string().uuid(),
  lessonId: z.string().uuid(),
  title: z.string(),
  questions: z.array(PersonalityQuizQuestionSchema),
  userAttempt: z.union([
    PersonalityQuizUserAttemptSchema,
    z.literal("JSON_NULL")
  ]).optional(),

  result: z.union([
    PersonalityQuizResultSchema,
    z.literal("JSON_NULL")
  ]).optional(),
  takenAt: z.any().optional().nullable()
})

export const CreatePersonalityQuizDto = extendApi(basePersonalityQuizSchema, {
  title: 'CreatePersonalityQuizDto',
  example: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    lessonId: '660e8400-e29b-41d4-a716-446655440000',
    title: 'Personality Test - Work Style',
    questions: [
      {
        question: "Saya menikmati bekerja dengan orang lain.",
        type: "multiple_choice",
        difficulty: "easy",
        options: [
          "Sangat Tidak Setuju",
          "Tidak Setuju",
          "Netral",
          "Setuju",
          "Sangat Setuju"
        ],
        answer: "Setuju"
      }
    ],
    userAttempt: null,
    result: null
  }
})

export type CreatePersonalityQuizType = z.infer<typeof CreatePersonalityQuizDto>

export const UpdatePersonalityQuizDto = extendApi(
  basePersonalityQuizSchema.partial(),
  {
    title: 'UpdatePersonalityQuizDto',
    example: {
      userAttempt: [
        {
          question: "Saya menikmati bekerja dengan orang lain.",
          userAnswer: "Setuju",
          answer: "Setuju"
        }
      ],
      result: {
        scores: { sociability: 80, teamwork: 70 },
        overallScore: 75,
        level: "intermediate",
        traitLabel: "Collaborative Thinker",
        interpretation: "Kamu cenderung bekerja baik dalam tim...",
        recommendedSteps: [{ stepId: "abcd-1234", priority: 1 }],
        skipSteps: ["step-2", "step-5"]
      }
    }
  }
)

export type UpdatePersonalityQuizType = z.infer<typeof UpdatePersonalityQuizDto>
