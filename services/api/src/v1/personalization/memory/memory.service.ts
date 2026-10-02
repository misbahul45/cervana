import { Injectable } from '@nestjs/common';
import { MemoryRepo } from './memory.repo';

const SHORT_TERM_CAP = 20;
const SHORT_TERM_TTL_DAYS = 90;

export type MemoryKind = 'SHORT_TERM' | 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION';

export interface RecordMemoryInput {
  userId: string;
  lessonId?: string;
  kind: MemoryKind;
  payload: unknown;
}

@Injectable()
export class MemoryService {
  constructor(
    private readonly repo: MemoryRepo,
    private readonly ttlDays: number = SHORT_TERM_TTL_DAYS,
    private readonly cap: number = SHORT_TERM_CAP,
  ) {}

  buildContent(input: RecordMemoryInput): { content: string; expiresAt: Date | null } {
    const content = typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload);
    const expiresAt =
      input.kind === 'SHORT_TERM' ? new Date(Date.now() + this.ttlDays * 86_400_000) : null;
    return { content, expiresAt };
  }

  async record(input: RecordMemoryInput) {
    const { content, expiresAt } = this.buildContent(input);
    const created = await this.repo.create({
      userId: input.userId,
      eventType: input.kind,
      content,
      source: 'api',
      lessonId: input.lessonId ?? null,
      expiresAt,
    });
    if (input.kind === 'SHORT_TERM' && input.lessonId) {
      const trimmed = await this.repo.trimForLesson(input.userId, input.lessonId, this.cap);
      void trimmed;
    }
    return created;
  }

  async listForLesson(input: {
    userId: string;
    lessonId: string;
    kind?: MemoryKind;
    allowCrossLesson?: boolean;
  }) {
    if (input.allowCrossLesson) {
      const items = await this.repo.listAllByUser(input.userId, input.kind);
      return items;
    }
    const items = await this.repo.listAllByUser(input.userId, input.kind);
    return items.filter((m: any) => m.lessonId === input.lessonId);
  }

  async listLongTermProfile(userId: string) {
    return this.repo.listAllByUser(userId, 'LONG_TERM_PROFILE');
  }

  async distillProfile(userId: string) {
    const items = await this.repo.listAllByUser(userId, 'SHORT_TERM');
    const summary = {
      count: items.length,
      lastActiveAt: items[0]?.createdAt ?? null,
      themes: this.extractThemes(items),
    };
    await this.repo.create({
      userId,
      eventType: 'LONG_TERM_PROFILE',
      content: JSON.stringify(summary),
      source: 'api:distill',
    });
    return summary;
  }

  private extractThemes(items: unknown[]): string[] {
    const set = new Set<string>();
    for (const item of items) {
      const record = item as { topicId?: string | null; lessonId?: string | null };
      if (record.topicId) set.add(record.topicId);
      else if (record.lessonId) set.add(record.lessonId);
    }
    return [...set];
  }
}