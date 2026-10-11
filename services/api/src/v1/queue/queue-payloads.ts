import { z } from 'zod';

export const CREDENTIAL_KEY = /token|authorization|secret|password|cookie/i;

export const credentialFree = <T extends z.ZodObject<z.ZodRawShape>>(schema: T): T => {
  const offending = Object.keys(schema.shape).filter((key) => CREDENTIAL_KEY.test(key));
  if (offending.length > 0) {
    throw new Error(`A job payload must not carry credentials: ${offending.join(', ')}`);
  }
  return schema;
};

const id = z.string().min(1);

export const UserStepsJobSchema = credentialFree(
  z
    .object({
      userId: id,
      topicId: id,
      lessonId: id,
      learningStyleId: id,
      quizId: id,
    })
    .strict(),
);

export const KnowledgeJobSchema = credentialFree(
  z
    .object({
      resourceId: id,
      userId: id,
    })
    .strict(),
);

export const ContentEmbeddingJobSchema = credentialFree(
  z
    .object({
      contentId: id,
      chatId: id,
      textContent: z.string(),
    })
    .strict(),
);

export type UserStepsJob = z.infer<typeof UserStepsJobSchema>;
export type KnowledgeJob = z.infer<typeof KnowledgeJobSchema>;
export type ContentEmbeddingJob = z.infer<typeof ContentEmbeddingJobSchema>;

export const readUserStepsJob = (data: unknown): UserStepsJob => z.object(UserStepsJobSchema.shape).parse(data);

export const readKnowledgeJob = (data: unknown): KnowledgeJob => z.object(KnowledgeJobSchema.shape).parse(data);
