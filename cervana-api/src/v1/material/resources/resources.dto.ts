import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";
import { JOBSTATUSTYPE, ResourceType } from "@prisma/client";

const ResourceTypeEnum = z.nativeEnum(ResourceType);

const ResourceFileSchema = z.object({
  url: z.string().url({ message: "URL wajib ada dan harus valid" }),
  fileId: z.string().optional(),
});
const JobStatusEnum = z.nativeEnum(JOBSTATUSTYPE);

export const baseResourceSchema = z.object({
  id: z.string().uuid().optional(),
  type: ResourceTypeEnum,
  title: z.string().min(1, "Title tidak boleh kosong").optional(),
  content: z.string().optional(),
  file: ResourceFileSchema.optional(),
  isEmbedded: z.boolean().default(false),
  embeddingAt: z.date().optional(),
  jobStatus: JobStatusEnum.optional(),
  topicId: z.string().uuid().optional(),
  subTopicId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// CREATE DTO
export const CreateResourceDto = extendApi(
  baseResourceSchema.omit({ id: true, createdAt: true, updatedAt: true }),
  {
    title: "CreateResourceDto",
    example: {
      type: "PDF",
      title: "Machine Learning Book",
      content: "A comprehensive guide to machine learning.",
      fileNames: {
        url: "https://example.com/book.pdf",
        fileId: "file_123",
      },
    },
  }
);

export type CreateResourceType = z.infer<typeof CreateResourceDto>;

// UPDATE DTO (semua optional)
export const UpdateResourceDto = extendApi(
  baseResourceSchema
    .partial()
    .omit({ id: true, createdAt: true, updatedAt: true }),
  {
    title: "UpdateResourceDto",
    example: {
      title: "Machine Learning Book (Revised Edition)",
      content: "Updated explanation with new examples.",
      fileNames: {
        url: "https://example.com/book_v2.pdf",
        fileId: "file_456",
      },
    },
  }
);

export type UpdateResourceType = z.infer<typeof UpdateResourceDto>;
