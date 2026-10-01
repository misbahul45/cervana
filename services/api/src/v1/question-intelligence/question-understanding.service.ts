import { z } from 'zod';

export const QuestionIntentSchema = z.enum([
  'NEW_LEARNING',
  'PRACTICE',
  'DOUBT',
  'CHALLENGE',
  'TRANSFER',
  'CLARIFICATION',
  'EXPLORATION',
]);

export const CognitiveDemandSchema = z.enum([
  'RECALL',
  'RECOGNITION',
  'CONCEPTUAL',
  'PROCEDURAL',
  'WHY',
  'HOW',
  'COMPARE',
  'CLASSIFY',
  'DIAGNOSTIC',
  'ERROR_ANALYSIS',
  'ANALYTICAL',
  'TRANSFER',
  'COUNTERFACTUAL',
  'SYNTHESIS',
  'METACOGNITIVE',
  'CRITICAL_EVALUATION',
]);

export const MisconceptionHypothesisSchema = z.object({
  conceptKey: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceKeys: z.array(z.string()).default([]),
});

export const QuestionUnderstandingSchema = z.object({
  intent: QuestionIntentSchema,
  domain: z.string().min(1),
  subject: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  conceptIds: z.array(z.string()).default([]),
  prerequisiteIds: z.array(z.string()).default([]),
  questionType: z.enum(['MCQ', 'SHORT_ANSWER', 'LONG_ANSWER', 'CODING', 'SANDBOX', 'MATCHING', 'TRUE_FALSE', 'FILL_BLANK']),
  cognitiveDemand: CognitiveDemandSchema,
  ambiguity: z.number().min(0).max(1),
  difficultyEstimate: z.number().min(0).max(1),
  knowledgeGap: z.string().optional(),
  misconceptionHypotheses: z.array(MisconceptionHypothesisSchema).default([]),
  requestedHelp: z.boolean().default(false),
  currentObjective: z.string().optional(),
  needsDomainTool: z.boolean().default(false),
  evidenceRequired: z.array(z.string()).default([]),
  clarifyingQuestion: z.string().optional(),
});

export type QuestionUnderstanding = z.infer<typeof QuestionUnderstandingSchema>;

export const UNRESOLVED_CONCEPT_THRESHOLD = 0.5;
export const HIGH_AMBIGUITY_THRESHOLD = 0.6;

export interface RawQuestionInput {
  text: string;
  domain: string;
  conceptIds?: string[];
  prerequisiteIds?: string[];
  requestedHelp?: boolean;
  recentTopic?: string;
}

const CHALLENGE_TOKENS = ['tantang', 'sulit', 'kompleks'];
const PROCEDURAL_TOKENS = ['bagaimana', 'langkah', 'prosedur', 'cara', 'how to', 'steps', 'process'];
const WHY_TOKENS = ['mengapa', 'kenapa', 'why', 'jelaskan', 'alasan'];
const COMPARE_TOKENS = ['bandingkan', 'beda', 'perbedaan', 'sama', 'compare', 'difference'];
const HOW_TOKENS = ['bagaimana', 'how', 'gimana'];
const ERROR_TOKENS = ['salah', 'benar', 'kesalahan', 'wrong', 'error', 'kenapa ini salah'];
const TRANSFER_TOKENS = ['terapkan', 'kasus lain', 'apply', 'in a different', 'transfer'];
const DIAGNOSTIC_TOKENS = ['kenapa salah', 'apa yang kurang', 'what\'s wrong', 'dimana letak'];
const SYNTHESIS_TOKENS = ['gabungkan', 'buat kesimpulan', 'synthesize', 'summarize'];
const CRITICAL_TOKENS = ['kritik', 'evaluasi', 'nilai', 'evaluate', 'judge'];
const COUNTERFACTUAL_TOKENS = ['bagaimana jika', 'what if', 'kalau tidak', 'misalnya kalau'];
const CLASSIFY_TOKENS = ['jenis', 'macam', 'tipe', 'kategori', 'type', 'classify'];
const WHY_NOT_TOKENS = ['kenapa tidak', 'mengapa bukan', 'why not', 'kenapa bukan'];

export class QuestionUnderstandingService {
  understand(input: RawQuestionInput): QuestionUnderstanding {
    const lower = input.text.toLowerCase();
    const tokens = this.tokenize(lower);

    const intent = this.classifyIntent(input, tokens, lower);
    const cognitiveDemand = this.classifyCognitiveDemand(lower, tokens);
    const ambiguity = this.estimateAmbiguity(input.text, tokens);
    const difficultyEstimate = this.estimateDifficulty(input.text, tokens);
    const misconceptionHypotheses = this.extractMisconceptionHypotheses(input, tokens);
    const requestedHelp = Boolean(input.recentTopic) && this.isHelpRequest(lower, tokens);
    const knowledgeGap = this.summarizeKnowledgeGap(input, intent);

    const understanding: QuestionUnderstanding = {
      intent,
      domain: input.domain,
      subject: undefined,
      topic: input.recentTopic,
      conceptIds: input.conceptIds ?? [],
      prerequisiteIds: input.prerequisiteIds ?? [],
      questionType: this.inferQuestionType(input.text),
      cognitiveDemand,
      ambiguity,
      difficultyEstimate,
      knowledgeGap,
      misconceptionHypotheses,
      requestedHelp,
      currentObjective: this.deriveObjective(input, intent),
      needsDomainTool: this.needsDomainTool(input.domain, lower),
      evidenceRequired: this.evidenceRequired(intent, cognitiveDemand),
    };

    if (understanding.conceptIds.length === 0) {
      understanding.clarifyingQuestion = this.buildClarifyingQuestion(understanding);
    }
    if (ambiguity > HIGH_AMBIGUITY_THRESHOLD) {
      understanding.clarifyingQuestion = this.buildDiagnosticQuestion(understanding);
    }

    return understanding;
  }

  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(Boolean);
  }

  private classifyIntent(input: RawQuestionInput, tokens: string[], lower: string): QuestionUnderstanding['intent'] {
    if (input.recentTopic && this.isHelpRequest(lower, tokens)) return 'DOUBT';
    if (TRANSFER_TOKENS.some((t) => lower.includes(t))) return 'TRANSFER';
    if (CHALLENGE_TOKENS && lower.includes('tantang')) return 'CHALLENGE';
    if (PROCEDURAL_TOKENS.some((t) => lower.includes(t)) && this.isImperative(lower)) return 'PRACTICE';
    if (this.isQuestionShape(lower)) return 'NEW_LEARNING';
    return 'EXPLORATION';
  }

  private classifyCognitiveDemand(lower: string, _tokens: string[]): QuestionUnderstanding['cognitiveDemand'] {
    if (WHY_NOT_TOKENS.some((t) => lower.includes(t))) return 'CRITICAL_EVALUATION';
    if (ERROR_TOKENS.some((t) => lower.includes(t)) && DIAGNOSTIC_TOKENS.some((t) => lower.includes(t))) return 'ERROR_ANALYSIS';
    if (COUNTERFACTUAL_TOKENS.some((t) => lower.includes(t))) return 'COUNTERFACTUAL';
    if (CRITICAL_TOKENS.some((t) => lower.includes(t))) return 'CRITICAL_EVALUATION';
    if (SYNTHESIS_TOKENS.some((t) => lower.includes(t))) return 'SYNTHESIS';
    if (CLASSIFY_TOKENS.some((t) => lower.includes(t))) return 'CLASSIFY';
    if (COMPARE_TOKENS.some((t) => lower.includes(t))) return 'COMPARE';
    if (HOW_TOKENS.some((t) => lower.includes(t))) return 'HOW';
    if (WHY_TOKENS.some((t) => lower.includes(t))) return 'WHY';
    if (DIAGNOSTIC_TOKENS.some((t) => lower.includes(t))) return 'DIAGNOSTIC';
    if (this.isImperative(lower)) return 'PROCEDURAL';
    if (lower.includes('apa yang') || lower.includes('which')) return 'CONCEPTUAL';
    return 'CONCEPTUAL';
  }

  private estimateAmbiguity(text: string, tokens: string[]): number {
    let score = 0.2;
    if (text.length < 20) score += 0.25;
    if (text.length < 10) score += 0.2;
    if (tokens.length < 3) score += 0.15;
    if (!text.includes('?')) score += 0.1;
    if (tokens.length > 60) score += 0.1;
    return Math.min(1, Math.max(0, score));
  }

  private estimateDifficulty(text: string, tokens: string[]): number {
    let score = 0.4;
    if (text.length > 200) score += 0.1;
    if (tokens.length > 30) score += 0.15;
    if (/sintesis|kritis|evaluasi|bandingkan/i.test(text)) score += 0.2;
    if (/error|kesalahan|salah/i.test(text)) score += 0.1;
    if (text.includes('trans') || text.includes('terapkan')) score += 0.2;
    return Math.min(0.95, Math.max(0.05, score));
  }

  private extractMisconceptionHypotheses(_input: RawQuestionInput, tokens: string[]): QuestionUnderstanding['misconceptionHypotheses'] {
    if (!ERROR_TOKENS.some((t) => tokens.some((tok) => tok.includes(t)))) return [];
    return [
      {
        conceptKey: 'unspecified',
        description: 'Possible confusion between debit and credit on a transaction',
        confidence: 0.4,
        evidenceKeys: [],
      },
    ];
  }

  private isHelpRequest(lower: string, _tokens: string[]): boolean {
    return ['kenapa', 'mengapa', 'gimana', 'bagaimana', 'maksudnya', 'arti'].some((t) =>
      lower.includes(t),
    );
  }

  private isImperative(lower: string): boolean {
    return ['tolong', 'tolong bantu', 'bantu', 'tunjukkan', 'jelaskan'].some((t) =>
      lower.startsWith(t) || lower.includes(t),
    );
  }

  private isQuestionShape(lower: string): boolean {
    return lower.includes('?') || lower.startsWith('apa') || lower.startsWith('siapa') || lower.startsWith('bagaimana');
  }

  private summarizeKnowledgeGap(input: RawQuestionInput, intent: QuestionUnderstanding['intent']): string {
    if (intent === 'DOUBT') return `learner expresses doubt about: ${input.text.slice(0, 80)}`;
    if (intent === 'NEW_LEARNING') return `new question on: ${input.text.slice(0, 80)}`;
    if (intent === 'PRACTICE') return `wants procedural guidance for: ${input.text.slice(0, 80)}`;
    if (intent === 'TRANSFER') return `transfer target: ${input.text.slice(0, 80)}`;
    if (intent === 'CHALLENGE') return `stretch goal: ${input.text.slice(0, 80)}`;
    return `exploratory: ${input.text.slice(0, 80)}`;
  }

  private deriveObjective(input: RawQuestionInput, intent: QuestionUnderstanding['intent']): string {
    if (input.recentTopic && intent === 'DOUBT') return `resolve doubt about ${input.recentTopic}`;
    if (intent === 'NEW_LEARNING') return 'introduce a concept';
    if (intent === 'PRACTICE') return 'guide a procedure';
    if (intent === 'CHALLENGE') return 'stretch mastery';
    return 'support the learner';
  }

  private inferQuestionType(text: string): QuestionUnderstanding['questionType'] {
    if (/pilihan|choose|pilih|option/i.test(text)) return 'MCQ';
    if (/sandbox|jurnal|transaksi|neraca/i.test(text)) return 'SANDBOX';
    if (/code|kode|program/i.test(text)) return 'CODING';
    if (/benar atau salah/i.test(text)) return 'TRUE_FALSE';
    if (/isi|fill|lengkapi/i.test(text)) return 'FILL_BLANK';
    if (/jodohkan|matching/i.test(text)) return 'MATCHING';
    if (text.length > 200) return 'LONG_ANSWER';
    return 'SHORT_ANSWER';
  }

  private needsDomainTool(domain: string, lower: string): boolean {
    if (domain !== 'accounting') return false;
    return ['jurnal', 'neraca', 'transaksi', 'akun', 'saldo', 'debit', 'kredit', 'buku besar', 'laporan'].some(
      (t) => lower.includes(t),
    );
  }

  private evidenceRequired(intent: QuestionUnderstanding['intent'], demand: QuestionUnderstanding['cognitiveDemand']): string[] {
    const out: string[] = [];
    if (intent === 'DOUBT' || intent === 'NEW_LEARNING') out.push('learner_understanding');
    if (demand === 'WHY' || demand === 'CRITICAL_EVALUATION') out.push('concept_definition', 'example_artifact');
    if (demand === 'TRANSFER') out.push('similar_case', 'guidance_steps');
    if (demand === 'ERROR_ANALYSIS') out.push('learner_submission', 'canonical_solution');
    if (demand === 'PROCEDURAL') out.push('step_by_step');
    return out;
  }

  private buildClarifyingQuestion(understanding: QuestionUnderstanding): string {
    return `Which specific concept are you asking about? (${understanding.domain})`;
  }

  private buildDiagnosticQuestion(understanding: QuestionUnderstanding): string {
    return `Could you share more detail? A short example would help me answer precisely.`;
  }
}
