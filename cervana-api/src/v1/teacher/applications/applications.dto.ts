import z from "zod";
import { extendApi } from "@anatine/zod-openapi";
import { TeacherStatus } from "@prisma/client";

const applicationContent = z.object({
  fullName: z.string().min(1).max(200),
  bio: z.string().max(5000).optional(),
  cvUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  expertise: z.string().max(1000).optional(),
});

export const SubmitApplicationDto = extendApi(applicationContent.strict(), {
  title: "SubmitTeacherApplicationDto",
  example: {
    fullName: "Misbahul Munir",
    bio: "Expert in backend development and AI education.",
    cvUrl: "https://example.com/cv.pdf",
    portfolioUrl: "https://example.com/portfolio",
    expertise: "Backend Development, AI, Education",
  },
});

export type SubmitApplicationType = z.infer<typeof SubmitApplicationDto>;

export const UpdateApplicationDto = extendApi(applicationContent.partial().strict(), {
  title: "UpdateTeacherApplicationDto",
  example: { bio: "Updated biography" },
});

export type UpdateApplicationType = z.infer<typeof UpdateApplicationDto>;

export const ApproveApplicationDto = extendApi(
  z.object({ feedback: z.string().max(2000).optional() }).strict(),
  { title: "ApproveTeacherApplicationDto", example: { feedback: "Strong portfolio" } },
);

export type ApproveApplicationType = z.infer<typeof ApproveApplicationDto>;

export const RejectApplicationDto = extendApi(
  z.object({ feedback: z.string().min(3).max(2000) }).strict(),
  { title: "RejectTeacherApplicationDto", example: { feedback: "Please add teaching evidence" } },
);

export type RejectApplicationType = z.infer<typeof RejectApplicationDto>;

export const ApplicationListQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(TeacherStatus).optional(),
  q: z.string().max(100).optional(),
  userId: z.string().uuid().optional(),
});

export type ApplicationListQueryType = z.infer<typeof ApplicationListQueryDto>;
