import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

// =====================================================================
// 1. ChatMessage Schema
// =====================================================================
export const BaseChatMessageSchema = z.object({
  id: z.string().describe('Unique message identifier'),
  chatId: z.string().describe('Related chat ID'),
  role: z.enum(['USER', 'AI']).describe('Message sender role'),
  text: z.string().describe('Message content text'),
  fileUrls: z.array(z.string()).describe('Optional file URLs attached to this message'),

  createdAt: z.date().describe('Timestamp when the message was created'),
});

export const ChatMessageListSchema = extendApi(
  z.object({
    data: z.array(BaseChatMessageSchema).describe('List of chat messages'),
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of messages'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Whether there is a next page'),
      hasPrev: z.boolean().describe('Whether there is a previous page'),
    }).describe('Pagination details'),
  }),
  {
    title: 'ChatMessageList',
    example: {
      data: [
        {
          id: 'msg-uuid-123',
          chatId: 'chat-uuid-123',
          role: 'USER',
          text: 'Halo AI!',
          fileUrls: [],
          createdAt: '2024-08-17T10:00:00Z',
        },
        {
          id: 'msg-uuid-124',
          chatId: 'chat-uuid-123',
          role: 'AI',
          text: 'Halo! Ada yang bisa saya bantu?',
          fileUrls: [],
          createdAt: '2024-08-17T10:00:05Z',
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }
    }
  }
);

// =====================================================================
// 2. Chat Schema
// =====================================================================
export const BaseChatSchema = z.object({
  id: z.string().describe('Unique chat identifier'),
  stepId: z.string().describe('Related step ID'),
  title: z.string().describe('Chat title'),

  updatedAt: z.date().describe('Last updated timestamp'),
});

export const ChatDetailSchema = extendApi(
  BaseChatSchema.extend({
    messages: z.array(BaseChatMessageSchema).optional().describe('Messages under this chat'),
  }),
  {
    title: 'ChatDetail',
    example: {
      id: 'chat-uuid-123',
      stepId: 'step-uuid-456',
      title: 'Chat tentang JavaScript Dasar',
      updatedAt: '2024-08-17T10:05:00Z',
      messages: [
        {
          id: 'msg-uuid-123',
          chatId: 'chat-uuid-123',
          role: 'USER',
          text: 'Apa itu variable?',
          fileUrls: [],
          createdAt: '2024-08-17T10:00:00Z',
        },
        {
          id: 'msg-uuid-124',
          chatId: 'chat-uuid-123',
          role: 'AI',
          text: 'Variable adalah tempat untuk menyimpan data dalam program.',
          fileUrls: [],
          createdAt: '2024-08-17T10:00:05Z',
        }
      ]
    }
  }
);

export const ChatListSchema = extendApi(
  z.object({
    data: z.array(BaseChatSchema).describe('List of chats'),
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of chats'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Whether there is a next page'),
      hasPrev: z.boolean().describe('Whether there is a previous page'),
    }).describe('Pagination details'),
  }),
  {
    title: 'ChatList',
    example: {
      data: [
        {
          id: 'chat-uuid-123',
          stepId: 'step-uuid-456',
          title: 'Chat tentang JavaScript Dasar',
          updatedAt: '2024-08-17T10:05:00Z',
        },
        {
          id: 'chat-uuid-789',
          stepId: 'step-uuid-999',
          title: 'Chat tentang Python Dasar',
          updatedAt: '2024-08-16T18:30:00Z',
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      }
    }
  }
);
