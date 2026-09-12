import { z } from 'zod'
import { extendApi } from '@anatine/zod-openapi'

const baseLeaderboardScoreSchema = z.object({
  userId: z.string().uuid().describe('ID pengguna yang memiliki skor leaderboard'),
  categoryId: z.string().uuid().optional().nullable().describe('ID kategori (opsional)'),
  topicId: z.string().uuid().optional().nullable().describe('ID topik (opsional)'),
  subTopicId: z.string().uuid().optional().nullable().describe('ID subtopik (opsional)'),
  scope: z.enum(['GLOBAL', 'CATEGORY', 'TOPIC', 'SUBTOPIC']).default('GLOBAL').describe('Lingkup leaderboard'),
  score: z.number().int().default(0).describe('Skor pengguna dalam leaderboard'),
})

export const CreateLeaderboardScoreDto = extendApi(baseLeaderboardScoreSchema, {
  title: 'CreateLeaderboardScoreDto',
  example: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    categoryId: '7e4d8a12-b3d2-4b99-9c12-8e9c3a2a77aa',
    topicId: '2f34f4a1-c8e3-4a6a-92e1-6b1b2d5d9e00',
    subTopicId: null,
    scope: 'TOPIC',
    score: 1500,
  },
})
export type CreateLeaderboardScoreType = z.infer<typeof CreateLeaderboardScoreDto>

export const UpdateLeaderboardScoreDto = extendApi(baseLeaderboardScoreSchema.partial(), {
  title: 'UpdateLeaderboardScoreDto',
  example: {
    score: 2000,
    scope: 'GLOBAL',
  },
})
export type UpdateLeaderboardScoreType = z.infer<typeof UpdateLeaderboardScoreDto>
