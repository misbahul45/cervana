import { extendApi } from "@anatine/zod-openapi";
import z from "zod";

export const CreateContentDto = extendApi(
  z.object({
    chatId: z.string().uuid().describe("ID of the Chat this content belongs to"), // ✅ ditambahkan
    chatMessageId: z
      .string()
      .uuid()
      .describe("ID of the ChatMessage this content belongs to"),
    data: z
      .string()
      .describe("Main content data, e.g., markdown text, table, or structured JSON"),
    citations: z
      .union([z.array(z.string()), z.record(z.string(), z.any())])
      .optional()
      .describe("Optional citations or references for the content"),
    metadata: z
      .record(z.string(), z.any())
      .optional()
      .describe("Optional metadata such as difficulty, tags, or AI model info"),
  }),
  {
    title: "CreateContentRequest",
    example: {
      chatId: "a1234567-89ab-4cde-f012-3456789abcde", 
      chatMessageId: "b2345678-90cd-4ef1-2345-6789abcdef01",
      data: "##markdownn content here\n- item 1\n- item 2",
      citations: ["Buku Akuntansi SMK Kelas XI Hal. 23"],
      metadata: { difficulty: "beginner", source: "AI-generated" },
    },
  }
);

export type CreateContentDtoType = z.infer<typeof CreateContentDto>;
