import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { authMessage, fieldErrors } from '~/lib/auth-form';

describe('fieldErrors', () => {
  const schema = z.object({
    email: z.string().email('Email tidak valid'),
    password: z.string().min(8, 'Terlalu pendek').max(72, 'Terlalu panjang'),
  });

  it('is empty when the data is valid', () => {
    expect(fieldErrors(schema, { email: 'a@b.test', password: 'long-enough' })).toEqual({});
  });

  it('returns the first message per field, keyed by field name', () => {
    expect(fieldErrors(schema, { email: 'nope', password: 'x' })).toEqual({ email: 'Email tidak valid', password: 'Terlalu pendek' });
  });

  it('keeps only the first message when one field breaks several rules', () => {
    const strict = z.object({ code: z.string().min(6, 'Pendek').regex(/^\d+$/, 'Harus angka') });

    expect(fieldErrors(strict, { code: 'ab' })).toEqual({ code: 'Pendek' });
  });

  it('attaches a refinement error to the path it names', () => {
    const matching = z
      .object({ password: z.string(), confirmPassword: z.string() })
      .refine((v) => v.password === v.confirmPassword, { message: 'Tidak cocok', path: ['confirmPassword'] });

    expect(fieldErrors(matching, { password: 'a', confirmPassword: 'b' })).toEqual({ confirmPassword: 'Tidak cocok' });
  });
});

describe('authMessage', () => {
  it('translates the known API answers into Indonesian', () => {
    expect(authMessage('Invalid email or password', 400)).toBe('Email atau kata sandi salah.');
    expect(authMessage('Invalid or expired code', 400)).toContain('Kode salah atau sudah kedaluwarsa');
    expect(authMessage('Email already registered', 400)).toContain('sudah terdaftar');
  });

  it('turns rate limiting into a wait message, by status or by text', () => {
    expect(authMessage('whatever', 429)).toContain('Terlalu banyak percobaan');
    expect(authMessage('Too many login attempts. Please try again later.', 400)).toContain('Terlalu banyak percobaan');
  });

  it('says the service is struggling for server errors and for no answer at all', () => {
    expect(authMessage('Internal server error', 500)).toContain('Layanan sedang bermasalah');
    expect(authMessage('', 0)).toContain('Layanan sedang bermasalah');
    expect(authMessage(undefined, undefined)).toContain('Layanan sedang bermasalah');
  });

  it('falls back to a generic request message for an unknown client error', () => {
    expect(authMessage('Something unexpected', 400)).toBe('Permintaan belum berhasil. Periksa isian lalu coba lagi.');
  });
});
