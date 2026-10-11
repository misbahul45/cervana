export type NextConceptReason =
  | 'NO_CONCEPTS'
  | 'NO_EVIDENCE_START'
  | 'PREREQUISITES_MET'
  | 'CONTINUE_PRACTICE'
  | 'UNREACHABLE_PREREQUISITES'
  | 'ALL_CONCEPTS_PASSED';

export interface NextConceptView {
  conceptId: string | null;
  level: number | null;
  reasonCodes: NextConceptReason[];
  concept: { id: string; title: string; level: number } | null;
}

export interface NextConceptCopy {
  title: string;
  reason: string;
  done: boolean;
}

const REASONS: Readonly<Record<NextConceptReason, string>> = {
  NO_CONCEPTS: 'Konsep belajar belum tersedia untuk saat ini.',
  NO_EVIDENCE_START: 'Mulai dari dasar, satu konsep dulu.',
  PREREQUISITES_MET: 'Prasyaratmu sudah terpenuhi, saatnya konsep ini.',
  CONTINUE_PRACTICE: 'Kamu sedang di tengah konsep ini, lanjutkan latihannya.',
  UNREACHABLE_PREREQUISITES: 'Perkuat dulu prasyaratnya sebelum melangkah lebih jauh.',
  ALL_CONCEPTS_PASSED: 'Hebat, tidak ada lagi konsep yang tertinggal.',
};

export const nextConceptCopy = (view: NextConceptView): NextConceptCopy => {
  const code = view.reasonCodes[0] ?? 'NO_CONCEPTS';
  const reason = REASONS[code];
  if (code === 'ALL_CONCEPTS_PASSED') return { title: 'Semua konsep sudah lulus', reason, done: true };
  if (!view.concept) return { title: 'Belum ada konsep', reason, done: false };
  return { title: view.concept.title, reason, done: false };
};
