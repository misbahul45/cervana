export interface MembershipResponseLike {
  success: boolean;
  message?: string;
  meta?: { statusCode?: number };
  data?: { optedIn: boolean; handle: string | null } | null;
}

export interface MembershipMessage {
  tone: 'success' | 'danger';
  text: string;
}

export const toMembershipMessage = (response: MembershipResponseLike): MembershipMessage => {
  if (response.success) {
    return response.data?.optedIn
      ? { tone: 'success', text: `Kamu ikut papan sebagai @${response.data.handle}.` }
      : { tone: 'success', text: 'Kamu keluar dari papan peringkat. Namamu tidak lagi tampil.' };
  }
  const status = response.meta?.statusCode;
  if (status === 409) return { tone: 'danger', text: 'Nama panggilan itu sudah dipakai. Coba yang lain.' };
  if (status === 400) return { tone: 'danger', text: 'Nama panggilan harus 3 sampai 20 huruf kecil, angka, atau garis bawah.' };
  return { tone: 'danger', text: 'Pengaturan papan belum tersimpan. Coba lagi.' };
};
