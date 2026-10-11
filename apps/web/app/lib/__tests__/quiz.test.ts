import { describe, expect, it } from 'vitest';
import { buildSubmission, canSubmit, isAnswered, normalizeQuestions, resultSummary } from '~/lib/quiz';

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  quizId: 'q-1',
  question: `Soal ${id}`,
  questionType: 'MULTIPLE_CHOICE',
  options: ['A', 'B', 'C'],
  points: 1,
  sortOrder: 1,
  ...overrides,
});

describe('normalizeQuestions', () => {
  it('orders by sortOrder and keeps ids, type and points', () => {
    const questions = normalizeQuestions([row('b', { sortOrder: 2, points: 3 }), row('a', { sortOrder: 1 })]);

    expect(questions.map((q) => q.id)).toEqual(['a', 'b']);
    expect(questions[1]).toMatchObject({ type: 'MULTIPLE_CHOICE', points: 3, supported: true });
  });

  it('reads options given as plain strings or as objects with a text, label or value', () => {
    const [plain, objects] = normalizeQuestions([
      row('a', { sortOrder: 1, options: ['Kas', 'Piutang'] }),
      row('b', { sortOrder: 2, options: [{ text: 'Kas' }, { label: 'Piutang' }, { value: 'Utang' }, { other: 1 }] }),
    ]);

    expect(plain?.options).toEqual(['Kas', 'Piutang']);
    expect(objects?.options).toEqual(['Kas', 'Piutang', 'Utang']);
  });

  it('turns an HTML prompt into plain text and leaves a markdown prompt alone', () => {
    const [html, md] = normalizeQuestions([
      row('a', { sortOrder: 1, question: '<p>Apa itu <strong>aset</strong>?</p><script>x()</script>' }),
      row('b', { sortOrder: 2, question: 'Hitung **ekuitas**' }),
    ]);

    expect(html?.prompt).toBe('Apa itu aset?');
    expect(md?.prompt).toBe('Hitung **ekuitas**');
  });

  it('marks text style questions as written answers and file upload as unsupported', () => {
    const [text, caseStudy, file] = normalizeQuestions([
      row('a', { sortOrder: 1, questionType: 'TEXT', options: null }),
      row('b', { sortOrder: 2, questionType: 'CASE_STUDY', options: null }),
      row('c', { sortOrder: 3, questionType: 'FILE_UPLOAD', options: null }),
    ]);

    expect(text).toMatchObject({ supported: true, options: [] });
    expect(caseStudy).toMatchObject({ supported: true });
    expect(file).toMatchObject({ supported: false });
  });

  it('survives a missing list, a missing options field and an unknown type', () => {
    expect(normalizeQuestions(undefined)).toEqual([]);
    expect(normalizeQuestions([row('a', { options: undefined, questionType: 'WEIRD' })])[0]).toMatchObject({ options: [], supported: false });
  });
});

describe('answers', () => {
  const questions = normalizeQuestions([row('a', { sortOrder: 1 }), row('b', { sortOrder: 2, questionType: 'TEXT', options: null }), row('c', { sortOrder: 3, questionType: 'FILE_UPLOAD' })]);

  it('counts an answer only when it has visible text', () => {
    expect(isAnswered(questions[0]!, { a: 'A' })).toBe(true);
    expect(isAnswered(questions[0]!, { a: '   ' })).toBe(false);
    expect(isAnswered(questions[0]!, {})).toBe(false);
  });

  it('allows submitting once every supported question is answered, ignoring unsupported ones', () => {
    expect(canSubmit(questions, { a: 'A' })).toBe(false);
    expect(canSubmit(questions, { a: 'A', b: 'Jawaban saya' })).toBe(true);
    expect(canSubmit([], {})).toBe(false);
  });

  it('sends trimmed answers keyed by question id, only for supported questions', () => {
    expect(buildSubmission(questions, { a: 'A', b: '  Jawaban saya  ', c: 'x', z: 'y' })).toEqual({
      answers: { a: 'A', b: 'Jawaban saya' },
    });
  });
});

describe('resultSummary', () => {
  it('counts the correct answers and rounds the percentage', () => {
    expect(resultSummary({ a: true, b: false, c: true })).toEqual({ correct: 2, total: 3, percent: 67 });
  });

  it('is zero for an empty result instead of dividing by zero', () => {
    expect(resultSummary({})).toEqual({ correct: 0, total: 0, percent: 0 });
    expect(resultSummary(undefined)).toEqual({ correct: 0, total: 0, percent: 0 });
  });
});
