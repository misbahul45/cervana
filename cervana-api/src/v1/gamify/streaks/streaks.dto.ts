import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";
import { StreakActivity } from "@prisma/client";

const baseStreakHistorySchema = z.object({
  userId: z.string().uuid().describe("ID pengguna yang memiliki streak"),
  date: z.coerce.date().describe("Tanggal aktivitas"),
  activityType: z.nativeEnum(StreakActivity).describe("Jenis aktivitas streak"),
  streakCount: z.number().int().min(0).describe("Jumlah streak pada tanggal tersebut"),
});

export const CreateStreakHistoryDto = extendApi(baseStreakHistorySchema, {
  title: "CreateStreakHistoryDto",
  example: {
    userId: "550e8400-e29b-41d4-a716-446655440000",
    date: "2025-10-22",
    activityType: "LESSON_COMPLETED",
    streakCount: 5,
  },
});
export type CreateStreakHistoryType = z.infer<typeof CreateStreakHistoryDto>;

export const UpdateStreakHistoryDto = extendApi(baseStreakHistorySchema.partial(), {
  title: "UpdateStreakHistoryDto",
  example: {
    streakCount: 6,
  },
});
export type UpdateStreakHistoryType = z.infer<typeof UpdateStreakHistoryDto>;
