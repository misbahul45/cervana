import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

export const baseTeacherExperienceSchema = z.object({
  teacherApplicationId: z.string().uuid(),
  title: z.string().min(1),
  institution: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  description: z.string().optional(),
});

export const CreateTeacherExperienceDto = extendApi(
  z.union([baseTeacherExperienceSchema, z.array(baseTeacherExperienceSchema)]),
  {
    title: "CreateTeacherExperienceDto",
    example: [
      {
        teacherApplicationId: "uuid-app-1111",
        title: "Lecturer - Informatics Department",
        institution: "University of Indonesia",
        startDate: "2021-08-01T00:00:00.000Z",
        endDate: "2023-08-01T00:00:00.000Z",
        description: "Taught data structures and algorithms to undergraduate students.",
      },
    ],
  }
);

export type CreateTeacherExperienceType = z.infer<typeof CreateTeacherExperienceDto>;

export const UpdateTeacherExperienceDto = extendApi(
  baseTeacherExperienceSchema.partial(),
  {
    title: "UpdateTeacherExperienceDto",
    example: {
      title: "Senior Lecturer",
      description: "Promoted to senior lecturer with additional mentoring responsibilities.",
    },
  }
);

export type UpdateTeacherExperienceType = z.infer<typeof UpdateTeacherExperienceDto>;
