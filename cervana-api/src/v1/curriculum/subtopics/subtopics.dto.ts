import z from 'zod'
import { extendApi } from '@anatine/zod-openapi'

export const baseSubTopicSchema = z.object({
  title: z.string().min(1, "Title is required").describe("Subtopic title"),
  description: z.string().optional().describe("Optional subtopic description"),
  sortOrder: z.number().default(0).describe("Sort order for display"),
  topicId: z.string().min(1, "Topic ID is required").describe("Related topic ID"),
  themeId: z.string().min(1, "Theme ID is required").describe("Related theme ID"),
})

export const CreateSubTopicDto = extendApi(
  baseSubTopicSchema,
  {
    title: 'CreateSubTopicDto',
    example: {
      title: 'Variables & Data Types',
      description: 'Understanding variables and primitive types in JavaScript',
      sortOrder: 1,
      topicId: 'uuid-topic-1234',
      themeId: 'uuid-theme-1234',
    },
  }
)

export type CreateSubTopicType = z.infer<typeof CreateSubTopicDto>

export const UpdateSubTopicDto = extendApi(
  baseSubTopicSchema.partial(),
  {
    title: 'UpdateSubTopicDto',
    example: {
      title: 'Updated SubTopic Title',
      description: 'Updated subtopic description',
      sortOrder: 2,
      themeId: 'uuid-theme-5678',
    },
  }
)

export type UpdateSubTopicType = z.infer<typeof UpdateSubTopicDto>
