import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";
import { StreakActivity } from "@prisma/client";

export const MetadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.string(),
}).optional().nullable();

const baseDailyActivityLogSchema = z.object({
  userId: z.string().uuid().describe("ID pengguna yang melakukan aktivitas harian"),
  date: z.coerce.date().describe("Tanggal aktivitas"),
  activityType: z.nativeEnum(StreakActivity).describe("Jenis aktivitas harian"),
  metadata: MetadataSchema,
  lastAccessedAt: z.coerce.date().optional().nullable().describe("Waktu terakhir aktivitas diakses"),
});

export const CreateDailyActivityLogDto = extendApi(baseDailyActivityLogSchema, {
  title: "CreateDailyActivityLogDto",
  example: {
    userId: "550e8400-e29b-41d4-a716-446655440000",
    date: "2025-10-22",
    activityType: "QUIZ_COMPLETED",
    metadata: {
      title: "Menyelesaikan Kuis Harian",
      description: "Pengguna telah menyelesaikan kuis harian dan memperoleh skor.",
      type: "QUIZ_COMPLETED",
    },
    lastAccessedAt: "2025-10-22T14:30:00.000Z",
  },
});
export type CreateDailyActivityLogType = z.infer<typeof CreateDailyActivityLogDto>;

export const UpdateDailyActivityLogDto = extendApi(baseDailyActivityLogSchema.partial(), {
  title: "UpdateDailyActivityLogDto",
  example: {
    metadata: {
      title: "Update Aktivitas Harian",
      description: "Aktivitas pengguna diperbarui setelah kuis selesai.",
      type: "QUIZ_COMPLETED",
    },
    lastAccessedAt: "2025-10-23T10:15:00.000Z",
  },
});
export type UpdateDailyActivityLogType = z.infer<typeof UpdateDailyActivityLogDto>;
