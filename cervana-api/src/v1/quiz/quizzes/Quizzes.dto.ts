import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

const atLeastOneRelation = (data: any) => {
  return !!(
    data.stepId ||
    data.userStepId ||
    data.lessonId ||
    data.subTopicId ||
    data.topicId
  );
};

export const baseQuizSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    stepId: z.string().uuid().optional(),
    userStepId: z.string().uuid().optional(),
    lessonId: z.string().uuid().optional(),
    subTopicId: z.string().uuid().optional(),
    topicId: z.string().uuid().optional(),
    passingScore: z.number().min(0).max(100).default(70),
  })
  .refine(atLeastOneRelation, {
    message:
      "One of stepId, userStepId, lessonId, subTopicId, or topicId is required",
  });

export const CreateQuizDto = extendApi(
  z.union([baseQuizSchema, z.array(baseQuizSchema)]),
  {
    title: "CreateQuizDto",
    example: [
      {
        title: "Quiz JavaScript Dasar",
        stepId: "uuid-step-1111",
        passingScore: 70,
      },
      {
        title: "Quiz UserStep Leveling",
        userStepId: "uuid-userstep-2222",
        passingScore: 85,
      },
      {
        title: "Quiz Materi SubTopic",
        subTopicId: "uuid-subtopic-3333",
        passingScore: 75,
      },
    ],
  }
);

export type CreateQuizType = z.infer<typeof CreateQuizDto>;

export const UpdateQuizDto = extendApi(
  baseQuizSchema.partial(),
  {
    title: "UpdateQuizDto",
    example: {
      title: "Updated Quiz Title",
      passingScore: 90,
      stepId: "uuid-step-4444",
    },
  }
);

export type UpdateQuizType = z.infer<typeof UpdateQuizDto>;
