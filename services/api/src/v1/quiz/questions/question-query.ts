import { QuestionType } from '@prisma/client';
import { Query } from '@/common/interfaces';

const SORTABLE = new Set(['sortOrder', 'points', 'questionType']);
const INCLUDABLE = new Set(['quiz']);
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

export interface QuestionQuery {
  where: { quizId: string; questionType?: QuestionType; points?: number; sortOrder?: number };
  orderBy: Record<string, 'asc' | 'desc'>;
  include: Record<string, boolean> | undefined;
  page: number;
  limit: number;
  skip: number;
  take: number;
}

const positiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const integer = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

export const buildQuestionQuery = (quizId: string, q: Query): QuestionQuery => {
  const page = positiveInteger(q.page) ?? 1;
  const limit = Math.min(positiveInteger(q.limit) ?? DEFAULT_LIMIT, MAX_LIMIT);

  const where: QuestionQuery['where'] = { quizId };
  if (typeof q.questionType === 'string' && q.questionType in QuestionType) where.questionType = q.questionType as QuestionType;
  const points = integer(q.points);
  if (points !== null) where.points = points;
  const sortOrder = integer(q.sortOrder);
  if (sortOrder !== null) where.sortOrder = sortOrder;
  where.quizId = quizId;

  const [field, direction] = typeof q.sort === 'string' ? q.sort.split(':') : [];
  const orderBy: QuestionQuery['orderBy'] =
    field && SORTABLE.has(field) ? { [field]: direction === 'desc' ? 'desc' : 'asc' } : { sortOrder: 'asc' };

  const requested = (Array.isArray(q.include) ? q.include : typeof q.include === 'string' ? q.include.split(',') : [])
    .map((name) => name.trim())
    .filter((name) => INCLUDABLE.has(name));
  const include = requested.length ? Object.fromEntries(requested.map((name) => [name, true])) : undefined;

  return { where, orderBy, include, page, limit, skip: (page - 1) * limit, take: limit };
};
