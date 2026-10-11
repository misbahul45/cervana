export interface ContentCounts {
  draft: number;
  pending: number;
  published: number;
  rejected: number;
  total: number;
}

const EDITABLE = new Set(['DRAFT', 'REJECTED']);

export const isEditable = (status: string): boolean => EDITABLE.has(status);

export function contentCounts(items: ReadonlyArray<{ status: string }>): ContentCounts {
  const counts: ContentCounts = { draft: 0, pending: 0, published: 0, rejected: 0, total: items.length };
  for (const item of items) {
    if (item.status === 'DRAFT') counts.draft += 1;
    else if (item.status === 'PENDING_REVIEW') counts.pending += 1;
    else if (item.status === 'PUBLISHED') counts.published += 1;
    else if (item.status === 'REJECTED') counts.rejected += 1;
  }
  return counts;
}

export function sumCounts(first: ContentCounts, second: ContentCounts): ContentCounts {
  return {
    draft: first.draft + second.draft,
    pending: first.pending + second.pending,
    published: first.published + second.published,
    rejected: first.rejected + second.rejected,
    total: first.total + second.total,
  };
}

export interface NextStep {
  message: string;
  label: string;
  to: string;
}

export function nextStep(counts: ContentCounts): NextStep {
  if (counts.total === 0) {
    return { message: 'Belum ada karya. Mulai dengan menulis artikel pertamamu.', label: 'Tulis artikel', to: '/studio/articles/new' };
  }
  if (counts.rejected > 0) {
    return { message: `${counts.rejected} karya ditolak. Baca catatan peninjau, perbaiki, lalu kirim ulang.`, label: 'Perbaiki karya', to: '/studio/articles' };
  }
  if (counts.draft > 0) {
    return { message: `${counts.draft} draf menunggu diselesaikan dan dikirim untuk ditinjau.`, label: 'Lanjutkan menulis', to: '/studio/articles' };
  }
  if (counts.pending > 0) {
    return { message: `${counts.pending} karya sedang ditinjau admin. Kamu akan melihat statusnya berubah di sini.`, label: 'Lihat status', to: '/studio/articles' };
  }
  return { message: 'Semua karyamu sudah terbit. Pantau penjualan atau tulis karya baru.', label: 'Lihat pendapatan', to: '/studio/earnings' };
}

export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function sessionProblem(startsAt: string, endsAt: string, now: Date = new Date()): string | null {
  if (!startsAt || !endsAt) return 'Isi waktu mulai dan selesai sesi.';
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Waktu sesi tidak valid.';
  if (end <= start) return 'Waktu selesai harus setelah waktu mulai.';
  if (end <= now) return 'Sesi sudah lewat.';
  return null;
}

export function priceProblem(accessType: 'FREE' | 'PAID', price: number | null | undefined): string | null {
  if (accessType === 'FREE') return null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return 'Karya berbayar harus punya harga lebih dari nol.';
  if (!Number.isInteger(price)) return 'Harga harus bilangan bulat rupiah.';
  return null;
}

export interface ArticleForm {
  title: string;
  subtitle: string;
  body: string;
  accessType: 'FREE' | 'PAID';
  price: number | null;
}

export function articlePayload(form: ArticleForm) {
  return {
    title: form.title.trim(),
    content: form.body,
    excerpt: form.subtitle.trim(),
    accessType: form.accessType,
    ...(form.accessType === 'PAID' && form.price ? { price: form.price } : {}),
  };
}

export function articleProblem(form: ArticleForm): string | null {
  if (form.title.trim().length < 3) return 'Judul minimal 3 karakter.';
  if (!form.body.trim()) return 'Isi artikel belum ditulis.';
  return priceProblem(form.accessType, form.price);
}

export interface ClassForm {
  title: string;
  accessType: 'FREE' | 'PAID';
  price: number | null;
  durationMinutes: number | null;
  capacity: number | null;
}

export function classProblem(form: ClassForm): string | null {
  if (form.title.trim().length < 3) return 'Judul minimal 3 karakter.';
  const price = priceProblem(form.accessType, form.price);
  if (price) return price;
  if (form.durationMinutes !== null && form.durationMinutes !== undefined && (form.durationMinutes < 5 || form.durationMinutes > 6000)) {
    return 'Durasi harus antara 5 dan 6000 menit.';
  }
  if (form.capacity !== null && form.capacity !== undefined && (!Number.isInteger(form.capacity) || form.capacity < 1)) {
    return 'Kapasitas minimal 1 peserta.';
  }
  return null;
}

export function httpsUrlProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https:\/\/[^\s]+$/i.test(trimmed) || trimmed.length > 600) return 'Tautan harus diawali https:// dan tanpa spasi.';
  return null;
}
