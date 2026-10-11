import type { ZodType } from 'zod';

export const fieldErrors = (schema: ZodType, data: unknown): Record<string, string> => {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '');
    if (field && !(field in errors)) errors[field] = issue.message;
  }
  return errors;
};

export const authMessage = (message: string | undefined, status: number | undefined): string => {
  const text = message ?? '';
  if (status === 429 || /too many/i.test(text)) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (/invalid email or password/i.test(text)) return 'Email atau kata sandi salah.';
  if (/invalid or expired code/i.test(text)) return 'Kode salah atau sudah kedaluwarsa. Minta kode baru bila perlu.';
  if (/email already registered/i.test(text)) return 'Email ini sudah terdaftar. Coba masuk, atau atur ulang kata sandi lewat "Lupa kata sandi".';
  if (!status || status >= 500) return 'Layanan sedang bermasalah. Coba lagi sebentar lagi.';
  return 'Permintaan belum berhasil. Periksa isian lalu coba lagi.';
};
