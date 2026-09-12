import { z } from 'zod'
import { extendApi } from '@anatine/zod-openapi'

// Enum mirror dari Prisma
export const NotificationTypeEnum = z.enum([
  'STREAK',
  'QUIZ',
  'ACHIEVEMENT',
  'SYSTEM',
])

// 🔹 Base schema (untuk reuse di Create & Update)
const baseNotificationSchema = z.object({
  userId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .describe('Optional: user ID yang menerima notifikasi. Jika null → global notification'),
  title: z
    .string()
    .min(1, 'Title is required')
    .describe('Judul notifikasi'),
  body: z
    .string()
    .optional()
    .nullable()
    .describe('Isi atau pesan notifikasi'),
  type: NotificationTypeEnum.describe('Tipe notifikasi'),
  isGlobal: z
    .boolean()
    .default(false)
    .describe('True jika notifikasi bersifat global (tanpa userId)'),
})

// 🔸 Create DTO
export const CreateNotificationDto = extendApi(
  z.union([
    baseNotificationSchema,
    z.array(baseNotificationSchema).min(1, 'At least one notification is required'),
  ]),
  {
    title: 'CreateNotificationDto',
    example: [
      {
        userId: 'f1a23c4d-56e7-89ab-cdef-0123456789ab',
        title: 'Streak Berhasil!',
        body: 'Kamu berhasil mempertahankan streak harianmu!',
        type: 'STREAK',
        isGlobal: false,
      },
      {
        userId: null,
        title: 'Pengumuman Penting',
        body: 'Server akan maintenance malam ini pukul 22:00.',
        type: 'SYSTEM',
        isGlobal: true,
      },
    ],
  },
)
export type CreateNotificationType = z.infer<typeof CreateNotificationDto>

// 🔸 Update DTO
export const UpdateNotificationDto = extendApi(
  baseNotificationSchema.partial(),
  {
    title: 'UpdateNotificationDto',
    example: {
      title: 'Perubahan Judul Notifikasi',
      body: 'Isi pesan telah diperbarui.',
      isGlobal: false,
    },
  },
)
export type UpdateNotificationType = z.infer<typeof UpdateNotificationDto>


export const ReadNotificationDto = extendApi(
  z.object({
    readAt: z
      .string()
      .datetime()
      .optional()
      .describe('Tanggal/waktu saat notifikasi ditandai sudah dibaca'),
  }),
  {
    title: 'ReadNotificationDto',
    example: {
      readAt: new Date().toISOString(),
    },
  },
)
export type ReadNotificationType = z.infer<typeof ReadNotificationDto>
