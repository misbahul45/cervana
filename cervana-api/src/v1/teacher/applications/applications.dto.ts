import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

export const baseTeacherApplicationSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1),
  bio: z.string().optional(),
  cvUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  expertise: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  reviewedBy: z.string().uuid().optional(),
  reviewedAt: z.date().optional(),
  feedback: z.string().optional(),
});

export const CreateTeacherApplicationDto = extendApi(
  baseTeacherApplicationSchema,
  {
    title: "CreateTeacherApplicationDto",
    example: {
      userId: "uuid-user-123",
      fullName: "Misbahul Munir",
      bio: "Expert in backend development and AI education.",
      cvUrl: "https://example.com/cv.pdf",
      portfolioUrl: "https://example.com/portfolio",
      expertise: "Backend Development, AI, Education",
    },
  }
);

export type CreateTeacherApplicationType = z.infer<typeof CreateTeacherApplicationDto>;

export const UpdateTeacherApplicationDto = extendApi(
  baseTeacherApplicationSchema.partial(),
  {
    title: "UpdateTeacherApplicationDto",
    example: {
      status: "APPROVED",
      feedback: "Excellent portfolio and teaching experience.",
      reviewedBy: "uuid-admin-456",
    },
  }
);

export type UpdateTeacherApplicationType = z.infer<typeof UpdateTeacherApplicationDto>;
