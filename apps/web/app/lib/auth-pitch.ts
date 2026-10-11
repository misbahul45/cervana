export interface AuthPitch {
  lead: string;
  accent: string;
  tail: string;
  body: string;
}

export const AUTH_PITCHES: Record<string, AuthPitch> = {
  '/login': {
    lead: 'Lanjutkan dari',
    accent: 'tempatmu berhenti',
    tail: '.',
    body: 'Satu penilaian hari ini menjaga streak-mu tetap menyala. XP dan bintang hanya untuk konsep yang benar-benar kamu kuasai.',
  },
  '/register': {
    lead: 'Naik level karena',
    accent: 'paham',
    tail: ', bukan karena klik.',
    body: 'Daftar dan mulai dari satu konsep. Setiap konsep yang lulus memberimu XP, bintang, dan pencapaian yang bisa kamu periksa asalnya.',
  },
  '/forgot-password': {
    lead: 'Tenang, progresmu',
    accent: 'aman',
    tail: '.',
    body: 'XP, streak, dan pencapaianmu tersimpan di akun. Atur ulang kata sandi dengan kode 6 angka dari emailmu, lalu lanjut belajar.',
  },
  '/verify-email': {
    lead: 'Satu langkah lagi,',
    accent: 'hampir sampai',
    tail: '.',
    body: 'Masukkan kode dari emailmu untuk mengaktifkan akun, lalu kerjakan penilaian pertamamu dan nyalakan streak hari ini.',
  },
};

const normalize = (path: string): string => {
  const bare = path.split('?')[0]?.split('#')[0] ?? '';
  return bare.length > 1 ? bare.replace(/\/+$/, '') : bare;
};

export const authPitch = (path: string): AuthPitch => AUTH_PITCHES[normalize(path)] ?? (AUTH_PITCHES['/register'] as AuthPitch);
