import { z } from 'zod'
import { extendApi } from '@anatine/zod-openapi'

// 🔹 Base Schema (digunakan untuk Create & Update)
const baseLearningStyleProfileSchema = z.object({
  userTopicId: z
    .string()
    .uuid()
    .describe('ID unik dari UserTopic (wajib diisi, 1:1 dengan userTopic)'),

  visual: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .nullable()
    .describe('Skor preferensi visual (0–1)'),

  auditory: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .nullable()
    .describe('Skor preferensi auditory (0–1)'),

  reading: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .nullable()
    .describe('Skor preferensi reading/writing (0–1)'),

  kinesthetic: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .nullable()
    .describe('Skor preferensi kinesthetic (0–1)'),

  dominantStyle: z
    .string()
    .optional()
    .nullable()
    .describe('Gaya belajar dominan (misalnya: visual, auditory, reading, kinesthetic)'),

  takenAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .describe('Tanggal/waktu tes dilakukan'),
})

// 🔸 Create DTO
export const CreateLearningStyleProfileDto = extendApi(baseLearningStyleProfileSchema, {
  title: 'CreateLearningStyleProfileDto',
  example: {
    userTopicId: '550e8400-e29b-41d4-a716-446655440000',
    visual: 7,
    auditory: 10,
    reading: 6,
    kinesthetic: 8,
    dominantStyle: 'visual',
    takenAt: '2025-10-22T10:00:00.000Z',
  },
})
export type CreateLearningStyleProfileType = z.infer<typeof CreateLearningStyleProfileDto>

// 🔸 Update DTO (semua opsional)
export const UpdateLearningStyleProfileDto = extendApi(baseLearningStyleProfileSchema.partial(), {
  title: 'UpdateLearningStyleProfileDto',
  example: {
    visual: 10,
    auditory: 5,
    dominantStyle: 'visual',
  },
})
export type UpdateLearningStyleProfileType = z.infer<typeof UpdateLearningStyleProfileDto>
