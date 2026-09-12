import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateContentDto, CreateContentDtoType } from './contents.dto';
import { ChatMessagesRepo } from '@/v1/chat/chat-messages/chat-messages.repo';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { QueueService } from '@/v1/queue/queue.service';

@Injectable()
export class ContentsRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatMessagesRepo: ChatMessagesRepo,
    private readonly queueService: QueueService,
  ) {}

  async findAll(q: Query) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;
      const { chatId, userId } = q;

      const where: any = {};
      if (chatId) where.message = { chatId };
      if (userId) where.message = { ...where.message, chat: { userId } };
      for (const key in q) {
          if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
              where[key] = q[key];
          }
      }


      const [data, total] = await Promise.all([
        this.prisma.content.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          skip,
          take: limit,
          include: {
            message: {
              select: {
                id: true,
                text: true,
                role: true,
                status: true,
                chatId: true,
              },
            },
          },
        }),
        this.prisma.content.count({ where }),
      ]);
      return {
        data: data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async findById(id: string) {
    return errorHandler(async () => {
      const content = await this.prisma.content.findUnique({ where: { id } });
      if (!content) return null;

      const embeddingsMetadata = await this.prisma.$queryRaw<Array<{
        id: string;
        chunkText: string;
        metadata: any;
        createdAt: Date;
        updatedAt: Date;
      }>>`
        SELECT id, chunk_text as "chunkText", metadata, created_at as "createdAt", updated_at as "updatedAt"
        FROM content_embeddings
        WHERE content_id = ${id}
        ORDER BY created_at
      `;

      return { ...content, embeddingsMetadata };
    });
  }

  async create(values: CreateContentDtoType) {
    return errorHandler(async () => {
      const validatedData = validation(CreateContentDto, values);

      const content = await this.prisma.content.create({
        data: validatedData,
        include: {
          message: {
            select: { chatId: true },
          },
        },
      });
      return content;
    });
  }

  async update(id: string, values: Partial<CreateContentDtoType>) {
    return errorHandler(async () => {
      const existingContent = await this.prisma.content.findUnique({
        where: { id },
        include: { message: true },
      });
      if (!existingContent) throw new Error('Content not found');

      const updateData = { ...values };
      const shouldUpdateEmbeddings = values.data !== undefined;

      const updatedContent = await this.prisma.content.update({
        where: { id },
        data: updateData,
        include: { message: true },
      });

      if (shouldUpdateEmbeddings) {
        const textContent = values.data!;

        const chatId = updatedContent.message?.chatId || values.chatId;

        if (chatId) {
          await this.queueService.addContentEmbeddingJob({
            contentId: updatedContent.id,
            chatId,
            textContent,
          });
        }
      }

      return updatedContent;
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      const deleted = await this.prisma.content.delete({
        where: { id },
        include: { message: true },
      });
      if (!deleted || !deleted.message?.id) {
        throw new AppError('content not found', 404, AppErrorCode.NOT_FOUND);
      }
      await this.chatMessagesRepo.delete(deleted.message?.id);
      return deleted;
    });
  }
}