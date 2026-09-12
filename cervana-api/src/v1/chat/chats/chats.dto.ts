import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";

export const CreateChatDto = extendApi(
  z.object({
    userStepId: z.string().uuid().describe("Step ID associated with this chat"),
    title: z.string().min(1, "Title is required").describe("Chat title"),
  }),
  {
    title: "CreateChatRequest",
    example: {
      stepId: "b13a5b6e-2345-4f5a-a9f9-1a2b3c4d5e6f",
      title: "Discussion about Step 1",
    },
  }
);


export type CreateChatDtoType = z.infer<typeof CreateChatDto>;