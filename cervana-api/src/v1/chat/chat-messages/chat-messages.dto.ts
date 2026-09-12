import { extendApi } from "@anatine/zod-openapi";
import { ChatRole, MessageStatus } from "@prisma/client";
import z from "zod";

export const CreateChatMessageDto = extendApi(
  z.object({
    chatId: z.string().uuid().describe("Chat ID to attach this message"),
    role: z.enum(ChatRole).describe("Role of the message sender"),
    text: z.string().min(1, "Message text is required").optional().describe("Message text"),
    status: z
      .enum(MessageStatus)
      .optional()
      .describe("Status of the message"),
  }),
  {
    title: "CreateChatMessageRequest",
    example: {
      chatId: "d14b1c32-78f2-4a92-a35b-cc0c788ab123",
      role: "user",
      text: "Hello AI, can you help me with this step?",
      status: "sent",
    },
  }
);

export const UpdateChatMessageDto = extendApi(
  z.object({
    text: z.string().min(1, "Updated text is required").describe("Updated message text"),
    status: z
      .enum(MessageStatus)
      .optional()
      .describe("Updated status of the message"),
  }),
  {
    title: "UpdateChatMessageRequest",
    example: {
      text: "Updated message text",
      fileUrls: ["https://example.com/updated-file.png"],
    },
  }
);


export type CreateChatMessageDtoType = z.infer<typeof CreateChatMessageDto>;
export type UpdateChatMessageDtoType = z.infer<typeof UpdateChatMessageDto>;

