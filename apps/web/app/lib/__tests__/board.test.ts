import { describe, expect, it } from 'vitest';
import { toMembershipMessage } from '~/lib/board';

describe('toMembershipMessage', () => {
  it('confirms joining with the handle and leaving without it', () => {
    expect(toMembershipMessage({ success: true, data: { optedIn: true, handle: 'budi_01' } })).toEqual({ tone: 'success', text: 'Kamu ikut papan sebagai @budi_01.' });
    expect(toMembershipMessage({ success: true, data: { optedIn: false, handle: 'budi_01' } }).text).toContain('keluar');
  });

  it('says a taken handle is taken, and a bad one is bad', () => {
    expect(toMembershipMessage({ success: false, meta: { statusCode: 409 } })).toEqual({ tone: 'danger', text: 'Nama panggilan itu sudah dipakai. Coba yang lain.' });
    expect(toMembershipMessage({ success: false, meta: { statusCode: 400 } }).text).toContain('3 sampai 20');
  });

  it('falls back to a generic failure for anything else', () => {
    expect(toMembershipMessage({ success: false, meta: { statusCode: 500 } }).tone).toBe('danger');
    expect(toMembershipMessage({ success: false })).toEqual({ tone: 'danger', text: 'Pengaturan papan belum tersimpan. Coba lagi.' });
  });
});
