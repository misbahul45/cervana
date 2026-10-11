import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';

const MIN_TOKEN_LENGTH = 3;
const CANDIDATE_LIMIT = 50;
const RESULT_LIMIT = 10;

const scoreContent = (text: string, tokens: string[]): number => {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (lower.includes(token)) hits += 1;
  }
  return hits / tokens.length;
};

@Injectable()
export class ContentSimilarityService {
  constructor(private readonly prisma: PrismaService) {}

  async findSimilar(chatId: string, query: string) {
    if (!chatId || !query) {
      throw new AppError('chatId and query are required', 400, AppErrorCode.VALIDATION_ERROR);
    }

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        userStep: { select: { userId: true } },
      },
    });

    if (!chat) {
      throw new NotFoundException(`Chat ${chatId} not found`);
    }

    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length >= MIN_TOKEN_LENGTH);

    if (tokens.length === 0) {
      return { data: [] };
    }

    const contents = await this.prisma.content.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATE_LIMIT,
    });

    const ranked = contents
      .map((content) => ({
        id: content.id,
        chatId: content.chatId,
        text: content.data ?? '',
        score: scoreContent(content.data ?? '', tokens),
      }))
      .filter((content) => content.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_LIMIT);

    return { data: ranked };
  }
}
