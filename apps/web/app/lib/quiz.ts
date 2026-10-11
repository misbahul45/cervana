import { plainText } from '~/lib/topics';

export type QuestionType = 'MULTIPLE_CHOICE' | 'TEXT' | 'FILE_UPLOAD' | 'CASE_STUDY';

export interface QuestionRow {
  id: string;
  question?: string | null;
  questionType?: string | null;
  options?: unknown;
  points?: number | null;
  sortOrder?: number | null;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  type: string;
  options: string[];
  points: number;
  supported: boolean;
}

const SUPPORTED = new Set(['MULTIPLE_CHOICE', 'TEXT', 'CASE_STUDY']);
const HTML_TAG = /<\/?[a-z][^>]*>/i;

const optionText = (option: unknown): string | null => {
  if (typeof option === 'string') return option;
  if (option && typeof option === 'object') {
    const record = option as Record<string, unknown>;
    for (const key of ['text', 'label', 'value']) {
      if (typeof record[key] === 'string') return record[key] as string;
    }
  }
  return null;
};

const optionsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(optionText).filter((text): text is string => text !== null) : [];

export const normalizeQuestions = (rows: ReadonlyArray<QuestionRow> | null | undefined): QuizQuestion[] =>
  [...(rows ?? [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => {
      const raw = row.question ?? '';
      const type = row.questionType ?? '';
      return {
        id: row.id,
        prompt: HTML_TAG.test(raw) ? plainText(raw) : raw,
        type,
        options: optionsOf(row.options),
        points: row.points ?? 1,
        supported: SUPPORTED.has(type),
      };
    });

export type Answers = Record<string, string | undefined>;

export const isAnswered = (question: QuizQuestion, answers: Answers): boolean => Boolean(answers[question.id]?.trim());

export const canSubmit = (questions: ReadonlyArray<QuizQuestion>, answers: Answers): boolean => {
  const required = questions.filter((question) => question.supported);
  return required.length > 0 && required.every((question) => isAnswered(question, answers));
};

export const buildSubmission = (questions: ReadonlyArray<QuizQuestion>, answers: Answers): { answers: Record<string, string> } => {
  const payload: Record<string, string> = {};
  for (const question of questions) {
    if (!question.supported) continue;
    const value = answers[question.id]?.trim();
    if (value) payload[question.id] = value;
  }
  return { answers: payload };
};

export const resultSummary = (isCorrect: Record<string, boolean> | null | undefined): { correct: number; total: number; percent: number } => {
  const values = Object.values(isCorrect ?? {});
  const correct = values.filter(Boolean).length;
  return { correct, total: values.length, percent: values.length === 0 ? 0 : Math.round((correct / values.length) * 100) };
};
