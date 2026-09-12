import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

const imageSchema = z.union([
  z.object({
    fileId: z.string().min(1, "File ID is required"),
    url: z.string().url().optional(),
  }).describe("Uploaded file info"),
]);


export const baseTopicSchema = z.object({
  title: z.string().min(1, "Title is required").describe("Topic title"),
  description: z.string().optional().describe("Optional topic description"),
  categoryIds: z.array(z.string().min(1))
    .optional()
    .describe("Array of related category IDs"),
  slug: z.string().optional().describe("Slug (auto-generated if not provided)"),
  image:imageSchema.describe('image for topic engagment'),
  createdBy: z.string().min(1, "Creator ID is required").describe("User ID of the topic creator"),
  price: z.number().describe("Price of the topic"),
  isVerified: z.boolean().default(false).describe("Whether the topic is verified"),
});

export const CreateTopicDto = extendApi(baseTopicSchema, {
  title: "CreateTopicDto",
  example: {
    title: "JavaScript Basics",
    description: "Intro to JS",
    categoryIds: ["uuid-category-1234", "uuid-category-5678"],
    createdBy: "uuid-user-1111",
    price: 0,
  },
});

export type CreateTopicType = z.infer<typeof CreateTopicDto>;

export const UpdateTopicDto = extendApi(baseTopicSchema.partial(), {
  title: "UpdateTopicDto",
  example: {
    title: "Updated Topic Title",
    description: "Updated topic description",
    categoryIds: ["uuid-category-1234", "uuid-category-5678"],
    isFree: false,
    price: 49.99,
    isVerified: true,
  },
});

export type UpdateTopicType = z.infer<typeof UpdateTopicDto>;
