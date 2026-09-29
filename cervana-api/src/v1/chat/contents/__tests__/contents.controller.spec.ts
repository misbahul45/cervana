import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContentsController } from '../contents.controller';
import { ContentsService } from '../contents.service';
import { ContentSseService } from '@/v1/sse/content-sse/content-sse.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError } from '@/common/lib/error';

describe('ContentsController - similarity', () => {
  let controller: ContentsController;
  let prisma: { chat: jest.Mock; content: jest.Mock };
  let contentsService: { findAll: jest.Mock; create: jest.Mock; remove: jest.Mock };
  let contentsSse: { emitUpdate: jest.Mock };

  const mockChat = {
    id: 'chat-1',
    userStep: { userId: 'user-1' },
  };

  const mockContents = [
    {
      id: 'c-1',
      chatId: 'chat-1',
      data: 'Debit accounts receivable credit revenue accrual',
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'c-2',
      chatId: 'chat-1',
      data: 'Adjusting entries for prepaid expenses',
      createdAt: new Date('2026-02-01'),
    },
    {
      id: 'c-3',
      chatId: 'chat-1',
      data: null,
      createdAt: new Date('2026-03-01'),
    },
  ];

  beforeEach(async () => {
    contentsService = {
      findAll: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };
    contentsSse = { emitUpdate: jest.fn() };
    prisma = {
      chat: { findUnique: jest.fn() },
      content: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentsController],
      providers: [
        { provide: ContentsService, useValue: contentsService },
        { provide: ContentSseService, useValue: contentsSse },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get<ContentsController>(ContentsController);
  });

  it('throws BadRequest when chatId is missing', async () => {
    await expect(
      controller.findSimilar('', 'query'),
    ).rejects.toThrow(AppError);
  });

  it('throws BadRequest when query is missing', async () => {
    await expect(
      controller.findSimilar('chat-1', ''),
    ).rejects.toThrow(AppError);
  });

  it('throws NotFound when chat does not exist', async () => {
    prisma.chat.findUnique.mockResolvedValue(null);

    await expect(
      controller.findSimilar('chat-1', 'some query'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns empty data when no tokens remain after split', async () => {
    prisma.chat.findUnique.mockResolvedValue(mockChat);

    const result = await controller.findSimilar('chat-1', 'a to');

    expect(result).toEqual({ data: [] });
    expect(prisma.content.findMany).not.toHaveBeenCalled();
  });

  it('ranks contents by token overlap', async () => {
    prisma.chat.findUnique.mockResolvedValue(mockChat);
    prisma.content.findMany.mockResolvedValue(mockContents);

    const result = await controller.findSimilar('chat-1', 'debit revenue');

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].id).toBe('c-1');
    expect(result.data[0].score).toBe(1.0);
  });

  it('filters out contents with score 0', async () => {
    prisma.chat.findUnique.mockResolvedValue(mockChat);
    prisma.content.findMany.mockResolvedValue(mockContents);

    const result = await controller.findSimilar('chat-1', 'unrelated xyz');

    expect(result.data).toEqual([]);
  });

  it('filters out contents with null data', async () => {
    prisma.chat.findUnique.mockResolvedValue(mockChat);
    prisma.content.findMany.mockResolvedValue(mockContents);

    const result = await controller.findSimilar('chat-1', 'debit');

    expect(result.data.every((c: any) => c.text !== '')).toBe(true);
    expect(result.data.every((c: any) => c.id !== 'c-3')).toBe(true);
  });

  it('caps results at 10', async () => {
    prisma.chat.findUnique.mockResolvedValue(mockChat);
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `c-${i}`,
      chatId: 'chat-1',
      data: 'debit credit revenue ' + i,
      createdAt: new Date(2026, 0, i + 1),
    }));
    prisma.content.findMany.mockResolvedValue(many);

    const result = await controller.findSimilar('chat-1', 'debit');

    expect(result.data.length).toBeLessThanOrEqual(10);
  });

  it('limits db query to 50 most recent contents', async () => {
    prisma.chat.findUnique.mockResolvedValue(mockChat);
    prisma.content.findMany.mockResolvedValue([]);

    await controller.findSimilar('chat-1', 'debit');

    expect(prisma.content.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});