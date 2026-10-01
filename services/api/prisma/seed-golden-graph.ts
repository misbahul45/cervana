import * as fs from 'fs';
import * as path from 'path';
import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface GoldenSubTopic {
  slug: string;
  title: string;
  description: string;
  prerequisiteSlugs: string[];
  lessons: Array<{ title: string; description: string }>;
}

const GOLDEN_TOPIC_SLUG = 'akuntansi-dasar-golden-graph';

const GOLDEN_GRAPH: GoldenSubTopic[] = [
  {
    slug: 'fundamentals',
    title: 'Akuntansi Fundamentals',
    description: 'Pengantar konsep dasar akuntansi: siapa pengguna laporan, mengapa akuntansi penting, dan siklus akuntansi secara umum.',
    prerequisiteSlugs: [],
    lessons: [
      {
        title: 'Apa itu akuntansi',
        description: 'Definisi akuntansi, pengguna laporan (internal & eksternal), dan lingkungan bisnis tempat akuntansi beroperasi.',
      },
      {
        title: 'Siklus akuntansi',
        description: 'Gambaran umum siklus akuntansi: identifikasi transaksi, penjurnalan, posting, neraca saldo, jurnal penyesuaian, laporan keuangan, penutupan.',
      },
    ],
  },
  {
    slug: 'equation',
    title: 'Persamaan Dasar Akuntansi',
    description: 'Aset = Liabilitas + Ekuitas dan implikasinya untuk transaksi sehari-hari.',
    prerequisiteSlugs: ['fundamentals'],
    lessons: [
      {
        title: 'Aset, liabilitas, ekuitas',
        description: 'Definisi dan contoh setiap elemen persamaan dasar.',
      },
      {
        title: 'Dampak transaksi pada persamaan',
        description: 'Bagaimana setiap transaksi bisnis mempertahankan keseimbangan persamaan.',
      },
    ],
  },
  {
    slug: 'account-types',
    title: 'Jenis Akun',
    description: 'Klasifikasi akun: riil (aset, liabilitas, ekuitas) vs. nominal (pendapatan, beban).',
    prerequisiteSlugs: ['equation'],
    lessons: [
      {
        title: 'Akun riil',
        description: 'Aset, liabilitas, ekuitas: sifat saldo normal dan pos di laporan posisi keuangan.',
      },
      {
        title: 'Akun nominal',
        description: 'Pendapatan dan beban: sifat saldo normal dan pos di laporan laba rugi.',
      },
    ],
  },
  {
    slug: 'debit-credit',
    title: 'Debit dan Kredit',
    description: 'Aturan debit/kredit untuk setiap jenis akun dan efeknya pada saldo.',
    prerequisiteSlugs: ['account-types'],
    lessons: [
      {
        title: 'Aturan debit/kredit',
        description: 'Tabel debit/kredit per jenis akun dengan contoh.',
      },
      {
        title: 'Saldo normal',
        description: 'Saldo normal setiap akun dan cara mengidentifikasinya.',
      },
    ],
  },
  {
    slug: 'double-entry',
    title: 'Double Entry',
    description: 'Prinsip double-entry: setiap transaksi memiliki debit dan kredit dengan nilai yang sama.',
    prerequisiteSlugs: ['debit-credit'],
    lessons: [
      {
        title: 'Logika double-entry',
        description: 'Mengapa double-entry bekerja dan apa yang terjadi jika tidak seimbang.',
      },
    ],
  },
  {
    slug: 'journal-entries',
    title: 'Jurnal Entries',
    description: 'Mencatat transaksi di jurnal umum dengan debit, kredit, dan penjelasan.',
    prerequisiteSlugs: ['double-entry'],
    lessons: [
      {
        title: 'Format jurnal umum',
        description: 'Tanggal, akun, ref, debit, kredit, penjelasan.',
      },
      {
        title: 'Contoh jurnal umum',
        description: 'Transaksi pembelian, penjualan, pembayaran, penerimaan kas.',
      },
    ],
  },
  {
    slug: 'ledger',
    title: 'Buku Besar',
    description: 'Posting dari jurnal ke akun-akun di buku besar, saldo berjalan, dan T-account.',
    prerequisiteSlugs: ['journal-entries'],
    lessons: [
      {
        title: 'T-account',
        description: 'Representasi visual akun: sisi debit vs sisi kredit.',
      },
      {
        title: 'Saldo berjalan',
        description: 'Menghitung saldo akun setelah setiap transaksi.',
      },
    ],
  },
  {
    slug: 'trial-balance',
    title: 'Neraca Saldo',
    description: 'Menjumlahkan saldo semua akun dan memverifikasi total debit = total kredit.',
    prerequisiteSlugs: ['ledger'],
    lessons: [
      {
        title: 'Menyusun neraca saldo',
        description: 'Daftar akun, saldo debit, saldo kredit, total.',
      },
      {
        title: 'Kegunaan dan keterbatasan',
        description: 'Apa yang dijamin dan tidak dijamin oleh neraca saldo.',
      },
    ],
  },
  {
    slug: 'adjusting-entries',
    title: 'Jurnal Penyesuaian',
    description: 'Jurnal penyesuaian accrual (beban dibayar di muka, pendapatan diterima di muka, akrual, penyusutan).',
    prerequisiteSlugs: ['trial-balance'],
    lessons: [
      {
        title: 'Accruals dan deferrals',
        description: 'Accrued expenses, accrued revenue, prepaid expenses, unearned revenue.',
      },
      {
        title: 'Penyusutan aset tetap',
        description: 'Metode garis lurus dan saldo menurun, dampak pada laporan.',
      },
    ],
  },
  {
    slug: 'financial-statements',
    title: 'Laporan Keuangan',
    description: 'Laporan posisi keuangan, laba rugi komprehensif, perubahan ekuitas, arus kas, dan catatan.',
    prerequisiteSlugs: ['adjusting-entries'],
    lessons: [
      {
        title: 'Laporan posisi keuangan',
        description: 'Format, pos utama, keseimbangan dengan persamaan akuntansi.',
      },
      {
        title: 'Laporan laba rugi',
        description: 'Pendapatan, beban, laba bersih, format single-step & multi-step.',
      },
      {
        title: 'Laporan arus kas',
        description: 'Arus kas operasi, investasi, pendanaan; metode langsung dan tidak langsung.',
      },
    ],
  },
];

async function main() {
  console.log('Seeding golden accounting graph...');

  const topicSlug = GOLDEN_TOPIC_SLUG;
  const existingTopic = await prisma.topic.findUnique({ where: { slug: topicSlug } });

  if (existingTopic) {
    console.log(`Topic "${topicSlug}" already exists, skipping golden graph seed.`);
    await prisma.$disconnect();
    return;
  }

  const category = await prisma.category.upsert({
    where: { name: 'Akuntansi' },
    update: {},
    create: { name: 'Akuntansi' },
  });

  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER' },
  });

  if (!teacher) {
    throw new Error('No TEACHER user found; run `pnpm seed` first to create base users.');
  }

  const topic = await prisma.topic.create({
    data: {
      title: 'Akuntansi Dasar — Golden Graph',
      slug: topicSlug,
      description: 'Urutan referensi pembelajaran akuntansi perguruan tinggi: persamaan dasar sampai laporan keuangan.',
      image: {},
      price: 0,
      topicDuration: 60,
      isVerified: true,
      categories: { connect: [{ id: category.id }] },
      teacher: { connect: { id: teacher.id } },
    },
  });

  const slugToId = new Map<string, string>();

  for (const node of GOLDEN_GRAPH) {
    const sub = await prisma.subTopic.create({
      data: {
        title: node.title,
        sortOrder: GOLDEN_GRAPH.indexOf(node) + 1,
        topicId: topic.id,
        description: node.description,
      },
    });
    slugToId.set(node.slug, sub.id);

    for (const [index, lesson] of node.lessons.entries()) {
      const createdLesson = await prisma.lesson.create({
        data: {
          title: lesson.title,
          sortOrder: index + 1,
          subTopicId: sub.id,
        },
      });
      await prisma.step.create({
        data: {
          title: `${lesson.title} — Ringkasan`,
          sortOrder: 1,
          lessonId: createdLesson.id,
        },
      });
    }
  }

  let prereqCount = 0;
  for (const node of GOLDEN_GRAPH) {
    const subId = slugToId.get(node.slug);
    if (!subId) continue;
    for (const reqSlug of node.prerequisiteSlugs) {
      const reqId = slugToId.get(reqSlug);
      if (!reqId) continue;
      await prisma.subTopicPrerequisite.create({
        data: { subTopicId: subId, requiresId: reqId },
      });
      prereqCount += 1;
    }
  }

  console.log(`✓ Seeded ${GOLDEN_GRAPH.length} sub-topics, ${prereqCount} prerequisites.`);
  console.log(`✓ Topic slug: ${topicSlug}`);
}

main()
  .catch(async (error) => {
    console.error('seed-golden-graph failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
