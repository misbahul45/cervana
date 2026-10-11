import { LANDING_FACTS as F } from '~/lib/landing-facts';

export interface ProblemCard {
  title: string;
  body: string;
  rule: string;
}

export const LANDING_COPY = {
  meta: {
    title: 'ReduCera: belajar akuntansi dengan gamifikasi yang jujur',
    description: `XP, streak, dan pencapaian hanya untuk penguasaan yang terbukti. ${F.concepts} konsep berprasyarat, aturan hadiah di database, dan papan peringkat yang opsional.`,
  },
  nav: [
    { label: 'Masalah', href: '#masalah' },
    { label: 'Cara kerja', href: '#cara-kerja' },
    { label: 'Gamifikasi', href: '#gamifikasi' },
    { label: 'Tema', href: '#tema' },
    { label: 'FAQ', href: '#faq' },
  ],
  hero: {
    headlineA: 'Naik level karena',
    accentA: 'paham',
    headlineB: ', bukan karena',
    accentB: 'klik',
    sub: 'XP, streak, dan pencapaian hanya dihitung dari penilaian yang membuktikan penguasaanmu. Aturannya tersimpan di database dan bisa diperiksa siapa saja.',
    primary: 'Mulai belajar',
    secondary: 'Lihat cara kerjanya',
    demoLabel: 'Contoh tampilan',
  },
  problem: {
    title: 'Streak yang bisa dicurangi tidak mengajarkan apa-apa.',
    lead: 'Banyak aplikasi memberi hadiah untuk aktivitas. Kamu bisa mengumpulkan poin tanpa memahami satu pun konsep.',
    cards: [
      { title: 'Login bukan belajar', body: 'Membuka aplikasi tidak membuktikan apa-apa tentang pemahamanmu.', rule: 'Login tidak pernah menambah streak atau XP.' },
      { title: 'Chat bukan belajar', body: 'Mengirim pesan ke tutor membantu, tetapi bukan penilaian.', rule: 'Pesan chat tidak pernah menambah streak atau XP.' },
      { title: 'Klik bukan belajar', body: 'Menyelesaikan langkah tanpa diuji hanya menandai halaman terbaca.', rule: 'Menyelesaikan langkah tidak memberi XP.' },
      { title: 'Volume bukan belajar', body: 'Seratus soal ngawur tidak lebih berharga dari sepuluh soal yang dipahami.', rule: 'Hadiah mengikuti kemajuan skor konsep, bukan jumlah soal.' },
    ] as ProblemCard[],
  },
  how: {
    title: 'Amati. Nilai. Hargai.',
    lead: 'Tiga hal harus terjadi sebelum satu poin diberikan.',
    steps: [
      { title: 'Amati', body: 'Setiap penilaian yang dikerjakan menjadi peristiwa belajar. Peristiwa disimpan berurutan per pembelajar dan tidak pernah diubah.' },
      { title: 'Nilai', body: 'Satu rumus penguasaan yang sama menghitung skor tiap konsep. Memakai petunjuk meredam kenaikan skor, dan mengulang soal bobotnya makin kecil.' },
      { title: 'Hargai', body: 'Aturan hadiah dibaca dari baris berversi di database. Setiap hadiah tercatat di buku besar yang tidak bisa diubah, dengan aturan dan versi yang membayarnya.' },
    ],
    ruleLabel: 'Contoh satu aturan hadiah di database',
    ledgerLabel: 'Contoh satu baris buku besar',
  },
  gamify: {
    title: 'Apa yang kamu dapat.',
    lead: 'Lima mekanisme, semuanya bisa ditelusuri ke penguasaan.',
    features: [
      { icon: 'xp', title: 'XP dari penguasaan', body: `Skor konsepmu naik, XP ikut naik. Lulus satu konsep (skor ${F.passScore.toString().replace('.', ',')} dengan sedikitnya ${F.passEvidence} bukti) memberi bonus ${F.xpPerConceptPassed} XP, sekali per konsep.` },
      { icon: 'streak', title: 'Streak yang jujur', body: 'Satu hari dihitung bila kamu menyelesaikan penilaian dengan bukti. Hari mengikuti zona waktumu. Sepuluh penilaian dalam sehari tetap satu hari.' },
      { icon: 'freeze', title: 'Pembeku yang diperoleh', body: `Setiap ${F.streakBonusEvery} hari beruntun kamu mendapat bonus XP dan satu pembeku streak, maksimal ${F.streakFreezeMax}. Tidak dijual dan tidak bisa dibeli.` },
      { icon: 'badge', title: 'Pencapaian dari aturan', body: `${F.achievements} pencapaian awal, masing-masing dengan aturan bertipe di database: jumlah penilaian, konsep lulus, streak, atau level.` },
      { icon: 'league', title: 'Peringkat yang opsional', body: 'Papan per topik, mingguan, dihitung dari konsep yang pertama kali lulus. Hanya yang ikut serta yang tampil, dengan nama panggilan.' },
    ],
  },
  theme: {
    title: 'Tampilan dan ikon datang dari database.',
    lead: `Warna, bentuk tombol, dan ${F.icons} ikon gamifikasi dibaca dari tema yang tersimpan. Ganti tema, seluruh antarmuka mengikuti.`,
    options: [
      { id: 'play', label: 'Play', note: 'Tema bawaan: terang, tombol tebal, ikon sendiri.' },
      { id: 'ocean', label: 'Samudra', note: 'Tema laut yang tenang. Ikon yang tidak diganti memakai bawaan.' },
    ],
  },
  proof: {
    title: 'Angka yang bisa kamu periksa.',
    items: [
      { value: String(F.concepts), label: 'konsep akuntansi saling berprasyarat' },
      { value: String(F.achievements), label: 'pencapaian awal dengan aturan di database' },
      { value: String(F.icons), label: 'ikon gamifikasi yang bisa diganti tema' },
      { value: '0', label: 'XP untuk login, chat, atau sekadar klik' },
    ],
  },
  faq: {
    title: 'Pertanyaan yang sering muncul.',
    items: [
      { q: 'Apakah streak bisa dicurangi?', a: 'Tidak lewat aktivitas kosong. Streak hanya bertambah bila kamu menyelesaikan penilaian yang menghasilkan bukti belajar. Login, chat, dan membuka halaman tidak dihitung.' },
      { q: 'Siapa yang cocok memakai ReduCera?', a: 'Saat ini kami mulai dari mahasiswa yang belajar akuntansi. Kurikulum dan konsepnya berprasyarat, jadi jalurmu mengikuti apa yang sudah kamu kuasai.' },
      { q: 'Apakah namaku tampil di papan peringkat?', a: 'Tidak. Papan bersifat opsional dan hanya menampilkan nama panggilan yang kamu pilih. Kamu bisa keluar kapan saja.' },
      { q: 'Dari mana aturan hadiah berasal?', a: 'Dari baris berversi di database. Mengubah angka berarti membuat versi baru, sehingga riwayat hadiah lama tidak pernah berubah.' },
      { q: 'Bisakah ikon dan warna diganti?', a: 'Ya. Warna, bentuk komponen, dan ikon gamifikasi dibaca dari tema yang tersimpan, jadi tema lain bisa menggantinya tanpa mengubah aplikasi.' },
    ],
  },
  closing: { title: 'Mulai dari satu konsep.', sub: 'Buktikan satu pemahaman hari ini, dan streak-mu dimulai.', primary: 'Daftar sekarang', secondary: 'Masuk' },
  footer: { rights: 'ReduCera', links: [{ label: 'Masuk', href: '/login' }, { label: 'Daftar', href: '/register' }, { label: 'Marketplace', href: '/marketplace' }] },
} as const;
