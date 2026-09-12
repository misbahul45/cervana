
import * as bcrypt from 'bcrypt';
import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient }from '@prisma/client'

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// ========== SUBTOPIC MAP (YUNIOR ONLY) ==========
const subTopicMap = {
  "Teknisi Akuntansi Yunior": [
    "Memproses Entry Jurnal",
    "Memproses Buku Besar",
    "Menyusun Laporan Keuangan",
    "Mengoperasikan Paket Program Pengolah Angka / Spreadsheet",
    "Mengoperasikan Aplikasi Komputer Akuntansi",
    "Menerapkan Prinsip Praktik Profesional dalam Bekerja",
    "Menerapkan Praktik Kesehatan dan Keselamatan di Tempat Kerja",
  ],
};

// ========== LESSON STRUCTURE WITH STEPS (BASED ON SKKNI) ==========
const lessonStructure = {
  "Teknisi Akuntansi Yunior": {
    "Memproses Entry Jurnal": [
      {
        title: "Memeriksa dokumen sumber dan dokumen pendukung",
        description: "Memeriksa kelengkapan dan otorisasi dokumen sumber dan pendukung",
        steps: [
          {
            title: "Pemeriksaan Dokumen Sumber",
            description: "Memeriksa kelengkapan dokumen sumber dan pendukung"
          },
          {
            title: "Verifikasi Otorisasi",
            description: "Memeriksa otorisasi oleh pihak yang berwenang dalam dokumen sumber"
          }
        ]
      },
      {
        title: "Mencatat dokumen sumber ke dalam jurnal",
        description: "Mengotorisasi jurnal dan mencatat dokumen sumber sesuai standar perusahaan",
        steps: [
          {
            title: "Otorisasi Jurnal",
            description: "Mengotorisasi jurnal sesuai dengan kebijakan dan prosedur perusahaan"
          },
          {
            title: "Pencatatan Dokumen",
            description: "Mencatat dokumen sumber ke dalam jurnal secara akurat dan sesuai dengan standar yang ditetapkan perusahaan"
          },
          {
            title: "Alokasi Transaksi",
            description: "Mengalokasikan transaksi secara tepat ke dalam sistem dan akun"
          }
        ]
      },
      {
        title: "Mengarsipkan dokumen Sumber dan Pendukung",
        description: "Menyimpan dan mengakses arsip dokumen sesuai prosedur perusahaan",
        steps: [
          {
            title: "Penyimpanan Dokumen",
            description: "Menyimpan dokumen sumber dan pendukung secara tepat waktu dan sesuai dengan prosedur dan kebijakan perusahaan"
          },
          {
            title: "Akses dan Penelusuran Arsip",
            description: "Mengakses dan menelusuri arsip dokumen sesuai kebijakan perusahaan"
          }
        ]
      }
    ],
    "Memproses Buku Besar": [
      {
        title: "Mempersiapkan pengelolaan buku besar",
        description: "Menyediakan peralatan, perlengkapan, buku besar, dan rekapitulasi jurnal",
        steps: [
          {
            title: "Persiapan Peralatan",
            description: "Menyediakan peralatan dan perlengkapan yang dibutuhkan untuk pengelolaan buku besar"
          },
          {
            title: "Penyediaan Buku Besar",
            description: "Menyediakan buku besar yang diperlukan"
          },
          {
            title: "Penyajian Rekapitulasi Jurnal",
            description: "Menyajikan rekapitulasi jurnal"
          }
        ]
      },
      {
        title: "Membukukan jumlah angka dari jurnal ke buku besar",
        description: "Mengidentifikasi akun dan membukukan jumlah dari rekapitulasi jurnal",
        steps: [
          {
            title: "Identifikasi Akun",
            description: "Mengidentifikasi akun-akun dalam buku besar yang diperlukan"
          },
          {
            title: "Posting ke Buku Besar",
            description: "Membukukan jumlah yang ada dalam rekapitulasi jurnal"
          }
        ]
      },
      {
        title: "Menyusun daftar saldo akun dalam buku besar",
        description: "Menyajikan dan memastikan kebenaran daftar saldo akun",
        steps: [
          {
            title: "Penyajian Daftar Saldo",
            description: "Menyajikan daftar saldo akun dalam buku besar sesuai dengan format yang telah ditetapkan"
          },
          {
            title: "Verifikasi Kebenaran Saldo",
            description: "Memastikan kebenaran saldo akun dalam buku besar"
          }
        ]
      }
    ],

    "Menyusun Laporan Keuangan": [
      {
        title: "Mencatat jurnal penyesuaian",
        description: "Menyediakan dokumen, mengidentifikasi akun, dan mencatat jurnal penyesuaian",
        steps: [
          {
            title: "Penyediaan Dokumen Sumber",
            description: "Menyediakan dokumen sumber penyesuaian"
          },
          {
            title: "Identifikasi Akun Penyesuaian",
            description: "Mengidentifikasi akun-akun yang memerlukan penyesuaian"
          },
          {
            title: "Pencatatan Jurnal Penyesuaian",
            description: "Mencatat jurnal penyesuaian yang diperlukan"
          }
        ]
      },
      {
        title: "Menyajikan laporan",
        description: "Menyiapkan neraca lajur dan menyajikan berbagai laporan keuangan sesuai standar",
        steps: [
          {
            title: "Persiapan Neraca Lajur",
            description: "Menyiapkan neraca lajur sesuai ketentuan SOP"
          },
          {
            title: "Penyajian Laporan Laba Rugi",
            description: "Menyajikan laporan laba rugi sesuai ketentuan SOP/SAK/SAK ETAP"
          },
          {
            title: "Penyajian Laporan Posisi Keuangan",
            description: "Menyajikan laporan neraca/laporan posisi keuangan sesuai ketentuan SOP/SAK/SAK ETAP"
          },
          {
            title: "Penyajian Laporan Perubahan Ekuitas",
            description: "Menyajikan laporan perubahan ekuitas sesuai ketentuan SOP/SAK/SAK ETAP"
          },
          {
            title: "Penyajian Laporan Arus Kas",
            description: "Menyajikan laporan arus kas sesuai ketentuan SOP/SAK/SAK ETAP"
          }
        ]
      },
      {
        title: "Mencatat jurnal penutup",
        description: "Mengidentifikasi dan mencatat jurnal penutup",
        steps: [
          {
            title: "Identifikasi Akun Penutup",
            description: "Mengidentifikasi akun yang didebit dan dikredit"
          },
          {
            title: "Pencatatan Jurnal Penutup",
            description: "Mencatat jurnal penutup"
          }
        ]
      },
      {
        title: "Memposting jurnal penyesuaian dan jurnal penutup ke buku besar",
        description: "Memposting jurnal dan menyajikan saldo setelah tutup buku",
        steps: [
          {
            title: "Posting Jurnal",
            description: "Memposting jurnal penyesuaian dan jurnal penutup"
          },
          {
            title: "Penyajian Saldo Setelah Tutup Buku",
            description: "Menyajikan saldo dalam buku besar setelah tutup buku sesuai ketentuan SOP"
          }
        ]
      }
    ],

    "Mengoperasikan Paket Program Pengolah Angka / Spreadsheet": [
      {
        title: "Mempersiapkan komputer dan paket program pengolah angka",
        description: "Menyediakan komputer, program, dan sumber data untuk pengolahan angka",
        steps: [
          {
            title: "Penyediaan Komputer",
            description: "Menyediakan komputer yang dibutuhkan untuk mengoperasikan paket program pengolah angka"
          },
          {
            title: "Persiapan Program",
            description: "Mempersiapkan paket program pengolah angka siap dioperasikan"
          },
          {
            title: "Persiapan Sumber Data",
            description: "Menyiapkan sumber data yang akan diolah dengan program pengolah angka"
          }
        ]
      },
      {
        title: "Mengentry data",
        description: "Mengidentifikasi karakter sel dan data, serta melakukan entry data",
        steps: [
          {
            title: "Identifikasi Karakter Sel",
            description: "Mengidentifikasi karakter sel"
          },
          {
            title: "Identifikasi Karakter Data",
            description: "Mengidentifikasi karakter data"
          },
          {
            title: "Entry Data",
            description: "Meng-entry data sesuai dengan karakter sel"
          },
          {
            title: "Verifikasi Hasil Entry",
            description: "Menyesuaikan hasil entry dengan sumber data"
          }
        ]
      },
      {
        title: "Mengolah data dengan menggunakan fungsi-fungsi program pengolah angka",
        description: "Mengolah data dengan berbagai rumus dan fungsi spreadsheet",
        steps: [
          {
            title: "Pengolahan dengan Rumus Matematika",
            description: "Mengolah data dengan rumus matematika"
          },
          {
            title: "Pengolahan dengan Rumus Statistik",
            description: "Mengolah data dengan rumus statistik"
          },
          {
            title: "Pengolahan dengan Fungsi Lanjutan",
            description: "Mengolah data dengan menggunakan rumus semi absolut, absolut dan fungsi logika"
          },
          {
            title: "Pengolahan dengan Fungsi Finansial",
            description: "Mengolah data dengan menggunakan fungsi finansial"
          },
          {
            title: "Pengolahan dengan Fungsi Date-Time",
            description: "Mengolah data dengan menggunakan fungsi date-time"
          },
          {
            title: "Pengolahan dengan Fungsi Grafik",
            description: "Mengolah data dengan menggunakan fungsi grafik"
          }
        ]
      },
      {
        title: "Membuat laporan",
        description: "Membuat laporan dalam bentuk tabel dan grafik",
        steps: [
          {
            title: "Pembuatan Laporan Tabel",
            description: "Membuat laporan dalam bentuk tabel"
          },
          {
            title: "Pembuatan Laporan Grafik",
            description: "Membuat laporan dalam bentuk grafik"
          }
        ]
      }
    ],

    "Mengoperasikan Aplikasi Komputer Akuntansi": [
      {
        title: "Menyiapkan data awal perusahaan",
        description: "Menyiapkan peralatan, perlengkapan, dan membuat data perusahaan",
        steps: [
          {
            title: "Persiapan Peralatan",
            description: "Menyiapkan peralatan dan perlengkapan yang dibutuhkan"
          },
          {
            title: "Pembuatan Data Perusahaan",
            description: "Membuat data perusahaan"
          }
        ]
      },
      {
        title: "Menyusun Data Setup Awal dan Saldo Awal",
        description: "Menyusun daftar akun, kode pajak, kartu piutang, kartu utang, dan kartu persediaan",
        steps: [
          {
            title: "Setup Daftar Akun",
            description: "Menyusun daftar akun dan meng-entry saldo awal akun"
          },
          {
            title: "Persiapan Kode Pajak",
            description: "Menyiapkan kode pajak"
          },
          {
            title: "Setup Kartu Piutang",
            description: "Membuat kartu piutang dan pelanggan, serta meng-entry saldo awal piutang"
          },
          {
            title: "Setup Kartu Utang",
            description: "Membuat kartu utang dan pemasok, serta meng-entry saldo awal utang"
          },
          {
            title: "Setup Kartu Persediaan",
            description: "Membuat kartu persediaan dan meng-entry saldo awal persediaan"
          }
        ]
      },
      {
        title: "Melakukan entry transaksi",
        description: "Menganalisis, meng-entry, dan melakukan penyesuaian transaksi serta tutup buku",
        steps: [
          {
            title: "Analisis Transaksi",
            description: "Menganalisis transaksi yang akan di-entry"
          },
          {
            title: "Entry Transaksi",
            description: "Meng-entry transaksi dengan menggunakan menu yang tepat"
          },
          {
            title: "Entry Penyesuaian",
            description: "Meng-entry penyesuaian dengan tepat"
          },
          {
            title: "Proses Tutup Buku",
            description: "Melakukan proses tutup buku secara tepat"
          }
        ]
      },
      {
        title: "Mencetak laporan keuangan dan laporan lainnya",
        description: "Membuat berbagai laporan keuangan dan laporan pendukung sesuai SOP",
        steps: [
          {
            title: "Laporan Laba Rugi",
            description: "Membuat laporan laba rugi sesuai dengan ketentuan SOP"
          },
          {
            title: "Laporan Neraca",
            description: "Membuat laporan neraca sesuai dengan ketentuan SOP"
          },
          {
            title: "Laporan Ekuitas",
            description: "Membuat laporan ekuitas sesuai dengan ketentuan SOP"
          },
          {
            title: "Laporan Arus Kas",
            description: "Membuat laporan arus kas sesuai dengan ketentuan SOP"
          },
          {
            title: "Laporan Piutang",
            description: "Membuat laporan piutang sesuai dengan ketentuan SOP"
          },
          {
            title: "Laporan Utang",
            description: "Membuat laporan utang sesuai dengan ketentuan SOP"
          },
          {
            title: "Laporan Persediaan",
            description: "Membuat laporan persediaan sesuai dengan ketentuan SOP"
          }
        ]
      },
      {
        title: "Membuat backup file",
        description: "Membuat dan menyimpan backup file data",
        steps: [
          {
            title: "Pembuatan Backup File",
            description: "Membuat backup file data sesuai dengan ketentuan SOP"
          },
          {
            title: "Penyimpanan Backup",
            description: "Menyimpan backup file data dalam media penyimpanan data"
          }
        ]
      }
    ],
        "Menerapkan Prinsip Praktik Profesional dalam Bekerja": [
      {
        title: "Mengidentifikasi luas, sektor dan tanggung jawab industri",
        description: "Memahami aspek eksternal yang mempengaruhi profesi teknisi akuntansi serta peran dan tanggung jawab berbagai pihak yang terlibat",
        steps: [
          {
            title: "Aspek Eksternal yang Mempengaruhi Profesi",
            description: "Mengidentifikasi aspek-aspek eksternal yang mempengaruhi profesi teknisi akuntansi dalam menjalankan pekerjaan"
          },
          {
            title: "Peran dan Tanggung Jawab Berbagai Pihak",
            description: "Mengidentifikasi peran dan tanggung jawab berbagai pihak yang terlibat dalam profesi teknisi akuntansi"
          }
        ]
      },
      {
        title: "Menerapkan pedoman, prosedur, dan aturan",
        description: "Mengumpulkan dan menganalisa informasi terkait hukum, peraturan, dan kode etik untuk menjalankan pekerjaan secara beretika",
        steps: [
          {
            title: "Pengumpulan dan Analisis Informasi Hukum",
            description: "Mengumpulkan dan menganalisa informasi yang berhubungan dengan hukum, peraturan dan kode etik"
          },
          {
            title: "Penentuan Relevansi Informasi",
            description: "Menentukan informasi hukum, peraturan dan kode etik dalam kaitannya dengan pihak yang bersangkutan di tempat kerja"
          },
          {
            title: "Penerapan Ketentuan Praktik Kerja",
            description: "Mempergunakan ketentuan tentang praktik kerja yang relevan sebagai dasar untuk menjalankan pekerjaan dan pengambilan keputusan secara beretika"
          }
        ]
      },
      {
        title: "Mengelola informasi",
        description: "Menganalisis, mengorganisir, dan menyajikan dokumen, laporan, data, dan kalkulasi sesuai kebutuhan",
        steps: [
          {
            title: "Analisis dan Organisasi Dokumen",
            description: "Menganalisis dan mengorganisir dokumen, laporan, data, dan kalkulasi sesuai kebutuhan konsumen dan/atau organisasi"
          },
          {
            title: "Penyajian Informasi",
            description: "Menyajikan informasi dalam format yang sesuai dengan kebutuhan pengguna informasi"
          }
        ]
      },
      {
        title: "Merencanakan penyelesaian pekerjaan dengan mempertimbangkan keterbatasan waktu dan sumber daya",
        description: "Menentukan tugas, merencanakan pekerjaan, dan beradaptasi dengan perubahan teknologi dan organisasi kerja",
        steps: [
          {
            title: "Penentuan Tugas dan Kondisi",
            description: "Menentukan tugas yang harus diselesaikan dan kondisi yang relevan"
          },
          {
            title: "Perencanaan Pekerjaan",
            description: "Merencanakan pekerjaan secara mandiri maupun secara tim untuk periode tertentu dengan mempertimbangkan sumber daya, waktu dan skala prioritas"
          },
          {
            title: "Adaptasi Perubahan",
            description: "Mengadaptasi perubahan teknologi dan organisasi kerja"
          }
        ]
      },
      {
        title: "Merancang dan mengelola kompetensi personal",
        description: "Mengidentifikasi kebutuhan pengembangan kompetensi, otorisasi, lisensi, dan menyelesaikan kesempatan pengembangan profesional",
        steps: [
          {
            title: "Identifikasi Kebutuhan Pengembangan",
            description: "Mengidentifikasi dan mengkaji ulang kebutuhan pengembangan kompetensi dan sasaran pengembangan secara periodik"
          },
          {
            title: "Identifikasi Kompetensi dan Lisensi",
            description: "Mengidentifikasi kebutuhan kompetensi, otorisasi, dan lisensi"
          },
          {
            title: "Penyelesaian Pengembangan Profesional",
            description: "Menyelesaikan kesempatan pengembangan profesional yang menggambarkan kebutuhan dan sasaran dalam jangka waktu tertentu"
          }
        ]
      }
    ],

    "Menerapkan Praktik Kesehatan dan Keselamatan di Tempat Kerja": [
      {
        title: "Mengikuti prosedur kerja untuk mengidentifikasi bahaya dan pengendalian resiko",
        description: "Mengenali bahaya, mengikuti prosedur pengendalian resiko, dan menjaga area kerja tetap aman",
        steps: [
          {
            title: "Identifikasi dan Pelaporan Bahaya",
            description: "Mengenali dan melaporkan bahaya di tempat kerja kepada yang berwenang sesuai dengan prosedur tempat kerja"
          },
          {
            title: "Pengendalian Resiko",
            description: "Mengikuti prosedur tempat kerja dan instruksi kerja untuk mengendalikan resiko secara akurat"
          },
          {
            title: "Prosedur Darurat",
            description: "Mengikuti prosedur tempat kerja yang berkaitan dengan kecelakaan, api, dan darurat"
          },
          {
            title: "Pemeliharaan Area Kerja",
            description: "Menjaga seluruh area kerja tetap bersih dan bebas dari gangguan"
          },
          {
            title: "Pengenalan Pintu Darurat",
            description: "Mengenali dan memastikan seluruh pintu darurat bebas setiap waktu"
          }
        ]
      },
      {
        title: "Berkontribusi untuk berpartisipasi dalam pengaturan manajemen kesehatan dan keselamatan kerja",
        description: "Menginformasikan isu K3, berkontribusi dalam manajemen K3, dan meninjau kembali prosedur K3",
        steps: [
          {
            title: "Informasi Isu K3",
            description: "Menginformasikan isu-isu kesehatan dan keselamatan kerja kepada aparat yang berwenang sesuai dengan prosedur tempat kerja"
          },
          {
            title: "Kontribusi Manajemen K3",
            description: "Memberikan kontribusi kepada manajemen kesehatan dan keselamatan kerja di tempat kerja sesuai dengan kebijakan dan prosedur organisasi"
          },
          {
            title: "Identifikasi Dokumen K3",
            description: "Mengidentifikasi, memeriksa secara periodik, dan menindaklanjuti rekomendasi dari dokumen kesehatan dan keselamatan kerja"
          },
          {
            title: "Klarifikasi Kewajiban K3",
            description: "Meninjau kembali klarifikasi kewajiban, prosedur dan praktik-praktik kesehatan dan keselamatan kerja bila diperlukan"
          }
        ]
      },
      {
        title: "Menerapkan praktik-praktik kesehatan dan keselamatan kerja",
        description: "Menerapkan prosedur K3, mengenali peringatan bahaya, dan mengidentifikasi situasi berbahaya",
        steps: [
          {
            title: "Penerapan Prosedur K3",
            description: "Menerapkan prosedur kesehatan dan keselamatan kerja setiap waktu dalam pekerjaan sehari-hari"
          },
          {
            title: "Pengenalan Peringatan Bahaya",
            description: "Mengenali dan mengobservasi peringatan bahaya dan tanda-tanda keselamatan"
          },
          {
            title: "Teknik Penanganan Keselamatan",
            description: "Menerapkan teknik-teknik penanganan keselamatan secara manual dan teknik keselamatan operasi peralatan setiap waktu"
          },
          {
            title: "Prosedur Pertolongan Pertama",
            description: "Mengikuti prosedur pertolongan pertama secara darurat"
          },
          {
            title: "Identifikasi Situasi Berbahaya",
            description: "Mengidentifikasi situasi yang secara potensial berbahaya, meliputi kegagalan dan peralatan berbahaya, dan melaporkan secara langsung"
          }
        ]
      }
    ],
  }
};

// Pre-generated UUIDs for lessons
const lessonIds = [
  "a9e0cdc2-de76-487d-8b24-9f53c093b872", "9fa0b225-7c2d-4a9b-a4d2-e019bfe87b47",
  "d79cc93b-b302-4c9d-9c8a-900b2a32f0af", "32aea39f-0cb1-486b-a62b-3ff578e6190c",
  "cbc4ef04-c88f-4157-8a89-20a8e7d43a8a", "566fb88f-5243-4bad-89a2-84194a33e48d",
  "5e64576f-9000-4477-b8c7-2eb07a5317c3", "a6361818-973d-421c-af41-c2440e1d69fd",
  "33694b3b-868b-4cf8-8d40-ab765f94e747", "ca2e1e79-dde3-4b3a-b659-3eb3cbe562d7",
  "89e8bc95-2b59-4f35-a841-1911872bed8b", "66d9980a-bebf-447f-a7a5-e852181e6f4b",
  "a5dae505-92bf-4a89-aae7-37c08e704108", "831764ca-754b-49a1-9cd2-4f11258c8597",
  "bd6af212-1ccf-402b-8716-8890df502b9e", "dcb14df0-168a-4415-b6b4-d499086a1115",
  "bd4d3dc0-011a-409e-bd52-b5d883f708ea", "f12ace27-55fd-4a62-a7f0-a85351db02ce",
  "f45cc4bc-cd08-4443-b1ae-f47ee1efcfc9", "52e9777d-e0de-4cb9-a41a-27594a166e58",
  "bb9664e3-8277-4ca7-b9ed-73171e10d80a", "a189d53e-325c-4626-939a-e248ed2d6507",
  "64482df0-4028-48ac-bc11-d2f76f4d6f89", "df574ac4-bc3e-4c7a-977b-16bd8948bcd3",
  "5ba1f8ce-d072-4d79-bc28-26cb6d04690e", "1c88e449-4ff1-45a9-a149-6a3c74ce0164",
];

const subTopicsId = [
  "1a4f6d90-1cc4-4ac1-baf9-fd61a3b42e2b", "8bb1d5c2-0f0e-41ab-9bdc-43e74c4dfb93",
  "c31b71f3-27e7-4b0d-9f3b-bb8d2e4ab91e", "f4c69128-3b8b-4a52-913e-1d3f70cf9493",
  "54d82f47-6fcb-4e1a-8048-8e4f5b522e65", "748f92e1-44e2-4a1f-9f7b-a4547fd1a7bb",
  "e2cd69ad-2b40-4964-b4fb-2ea30ab9c417"
];

async function main() {
  console.log('🌱 Starting database seed (Teknisi Akuntansi Yunior with SKKNI Steps)...');

  console.log('🧹 Cleaning existing data...');
  await prisma.userTopic.deleteMany({});
  await prisma.lessonProgress.deleteMany({});
  await prisma.subTopicProgress.deleteMany({});
  await prisma.step.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.subTopic.deleteMany({});
  await prisma.topic.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.themeIcon.deleteMany({});
  await prisma.theme.deleteMany({});
  await prisma.category.deleteMany({});
  console.log('✅ Data cleaned');

  // ========== CREATE CATEGORIES ==========
  const smkCategory = await prisma.category.create({ 
    data: { name: 'SMK' } 
  });

  // ========== CREATE USER ==========
  const hashedPassword = await bcrypt.hash('cervana123', 10);
  
  const teacher = await prisma.user.create({
    data: {
      name: 'Cervana Official Account',
      email: 'cervana456@gmail.com',
      password: hashedPassword,
      role: 'TEACHER',
      image: { url: 'https://avatar.iran.liara.run/public/11' },
      totalPoints: 6000,
      souls: 20,
      emailVerified: new Date(),
      stars: 100,
    },
  });

  // ========== CREATE TOPIC ==========
  console.log('📚 Creating topic...');
  
  const topic = await prisma.topic.create({
    data: {
      id: '7f5b2c4f-0c71-4bbd-b7ce-9bf2a7e2f912',
      title: 'Teknisi Akuntansi Yunior',
      slug: 'teknisi-akuntansi-yunior',
      description: generateSKKNIDescription('Teknisi Akuntansi Yunior'),
      image: { url: 'https://cdn.stocksnap.io/img-thumbs/960w/keyboard-computer_LDNV3SRTUI.jpg' },
      price: 0,
      createdBy: teacher.id,
      categories: { connect: { id: smkCategory.id } },
    },
  });

  console.log('✅ Topic created');
  
  // ========== CREATE THEMES WITH ICONS ==========
  console.log('🎨 Creating themes with icons...');

  const createdThemes = [];
  for (const themeData of themesData) {
    const theme = await prisma.theme.create({
      data: {
        title: themeData.title,
        description: themeData.description,
        primary: themeData.primary,
        secondary: themeData.secondary,
        tertiary: themeData.tertiary,
        quaternary: themeData.quaternary,
        icons: {
          create: themeData.icons.map((iconName) => ({
            name: iconName,
            imageIcon: { icon: iconName, color: themeData.primary }
          }))
        }
      }
    });
    //@ts-ignore
    createdThemes.push(theme);
  }

  console.log('✅ Themes with icons created');

  // ========== CREATE SUBTOPICS WITH DIFFERENT THEMES ==========
  console.log('📘 Creating subtopics...');
  
  const subtopics = subTopicMap[topic.title];
  let themeIndex = 0;

  for (let i = 0; i < subtopics.length; i++) {
    const subTopicTitle = subtopics[i];
    
    const selectedTheme = createdThemes[themeIndex % createdThemes.length];
    themeIndex++;
    //@ts-ignore
    await prisma.subTopic.create({
      data: {
        id: subTopicsId[i],
        title: subTopicTitle,
        description: generateSubTopicDescription(subTopicTitle),
        sortOrder: i + 1,
        topicId: topic.id,
        themeId: (selectedTheme.id),     //@ts-ignore
      },
    });
  }

  console.log("✅ SubTopics created");
  
  // ========== CREATE LESSONS AND STEPS ==========
  const topicWithSubTopics = await prisma.topic.findUnique({ 
    where: { id: topic.id },
    include: { subTopics: true } 
  });

  console.log('📖 Creating lessons and steps...');
  
  let lessonThemeIndex = 0;
  let lessonIdIndex = 0;

  const subTopicsMap = lessonStructure["Teknisi Akuntansi Yunior"];

  for (const subTopicTitle in subTopicsMap) {
    const subTopic = topicWithSubTopics.subTopics.find(st => st.title === subTopicTitle);

    if (!subTopic) continue;

    const lessons = subTopicsMap[subTopicTitle];

    for (let i = 0; i < lessons.length; i++) {
      const lessonData = lessons[i];

      // Ambil theme untuk lesson
      const lessonTheme = createdThemes[lessonThemeIndex % createdThemes.length];
      lessonThemeIndex++;

      // Ambil ID dari array
      const lessonId = lessonIds[lessonIdIndex];
      lessonIdIndex++;

      // CREATE LESSON dengan ID custom
      const lesson = await prisma.lesson.create({
        data: {
          id: lessonId,
          title: lessonData.title,
          description: lessonData.description,
          sortOrder: i + 1,
          subTopicId: subTopic.id,
          themeId: lessonTheme.id,
        }
      });

      console.log(`  ✓ Created lesson: ${lessonData.title}`);

      // CREATE STEPS berdasarkan kriteria unjuk kerja
      for (let stepIndex = 0; stepIndex < lessonData.steps.length; stepIndex++) {
        const stepData = lessonData.steps[stepIndex];
        
        // Ambil theme berikutnya untuk setiap step
        const stepTheme = createdThemes[lessonThemeIndex % createdThemes.length];
        lessonThemeIndex++;

        await prisma.step.create({
          data: {
            title: stepData.title,
            description: stepData.description,
            sortOrder: stepIndex + 1,
            lessonId: lesson.id,
            themeId: stepTheme.id,
          }
        });

        console.log(`    → Created step ${stepIndex + 1}: ${stepData.title}`);
      }
    }
  }

  console.log('✅ Lessons and steps created');
  console.log("🎉 SEED COMPLETE - Teknisi Akuntansi Yunior with SKKNI Steps!");
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 

// ========== THEME DEFINITIONS ==========
const themesData = [
  { 
    title: 'Ocean Breeze', 
    description: 'Tema segar dengan nuansa laut yang menenangkan',
    primary: '#0077BE', 
    secondary: '#005A8D', 
    tertiary: '#B3E5FC', 
    quaternary: '#E0F7FA',
    icons: ['Waves', 'Ship', 'Anchor']
  },
  { 
    title: 'Forest Harmony', 
    description: 'Kehangatan alam hutan yang asri',
    primary: '#2E7D32', 
    secondary: '#1B5E20', 
    tertiary: '#C8E6C9', 
    quaternary: '#F1F8E9',
    icons: ['Trees', 'Leaf', 'Sprout']
  },
  { 
    title: 'Sunset Glow', 
    description: 'Kehangatan cahaya senja yang memukau',
    primary: '#F57C00', 
    secondary: '#E65100', 
    tertiary: '#FFE0B2', 
    quaternary: '#FFF3E0',
    icons: ['Sunset', 'Sun', 'Mountain']
  },
  { 
    title: 'Royal Purple', 
    description: 'Kemewahan warna ungu yang elegan',
    primary: '#6A1B9A', 
    secondary: '#4A148C', 
    tertiary: '#E1BEE7', 
    quaternary: '#F3E5F5',
    icons: ['Crown', 'Gem', 'Award']
  },
  { 
    title: 'Arctic Ice', 
    description: 'Kesegaran es arktik yang membekukan',
    primary: '#00ACC1', 
    secondary: '#006064', 
    tertiary: '#B2EBF2', 
    quaternary: '#E0F7FA',
    icons: ['Snowflake', 'Wind', 'CloudSnow']
  },
  { 
    title: 'Cherry Blossom', 
    description: 'Kelembutan bunga sakura yang romantis',
    primary: '#EC407A', 
    secondary: '#AD1457', 
    tertiary: '#F8BBD0', 
    quaternary: '#FCE4EC',
    icons: ['Flower2', 'Heart', 'Sparkles']
  },
  { 
    title: 'Carbon Dark', 
    description: 'Profesionalitas dalam kegelapan',
    primary: '#424242', 
    secondary: '#212121', 
    tertiary: '#BDBDBD', 
    quaternary: '#EEEEEE',
    icons: ['Moon', 'Star', 'Zap']
  },
];

// ========== TOPIC DESCRIPTION ==========
function generateSKKNIDescription(level) {
  return `
    <h4>Teknisi Akuntansi Junior – Kompetensi Dasar Profesi Akuntansi</h4>
    <p>Kualifikasi <strong>Teknisi Akuntansi Junior</strong> merupakan pondasi awal bagi individu yang ingin berkarir di bidang akuntansi. Pada level ini, seseorang diharapkan mampu melaksanakan satu atau beberapa tugas spesifik secara terukur, menggunakan prosedur kerja standar, serta mengikuti instruksi dan pengawasan atasan secara langsung. Kemampuan ini menjadi dasar penting dalam mendukung kelancaran proses akuntansi pada perusahaan berskala kecil dan entitas tanpa akuntabilitas publik (ETAP).</p>

    <h5>Sifat Pekerjaan</h5>
    <p>Teknisi Akuntansi Junior bertugas menyelesaikan pekerjaan akuntansi dasar menggunakan alat, informasi, dan prosedur kerja yang lazim dalam industri. Tugas dilakukan secara mandiri pada ruang lingkup terbatas namun tetap dalam bimbingan supervisor. Setiap hasil kerja harus memenuhi standar mutu yang ditetapkan perusahaan.</p>

    <h5>Lingkup Aktivitas</h5>
    <ul>
      <li>Melakukan pencatatan transaksi harian sesuai prinsip akuntansi yang berlaku umum.</li>
      <li>Menyusun dokumen pendukung akuntansi seperti bukti transaksi, jurnal, dan rekap data.</li>
      <li>Mengoperasikan spreadsheet dan software akuntansi untuk kegiatan pengolahan data.</li>
      <li>Menyusun laporan keuangan sederhana untuk entitas jasa, dagang kecil, atau ETAP.</li>
      <li>Mengidentifikasi kebutuhan data, memilih metode yang sesuai, serta menerapkan langkah kerja terstruktur.</li>
      <li>Berkolaborasi dengan tim dan melakukan komunikasi kerja yang efektif.</li>
    </ul>

    <h5>Pengetahuan dan Kemampuan yang Dikuasai</h5>
    <ul>
      <li>Pengetahuan operasional dasar mengenai proses akuntansi dan siklus pencatatan transaksi.</li>
      <li>Pengetahuan faktual mengenai dokumen, prosedur kerja, serta standar akuntansi yang digunakan pada entitas kecil dan ETAP.</li>
      <li>Kemampuan memilih penyelesaian praktis terhadap masalah umum dalam proses akuntansi.</li>
      <li>Penguasaan prinsip dasar akuntansi yang relevan untuk entitas jasa dan dagang berskala mikro.</li>
      <li>Teknologi informasi dasar, termasuk penggunaan spreadsheet dan perangkat lunak akuntansi.</li>
      <li>Kemampuan interpersonal untuk bekerja dalam tim serta menjalin komunikasi efektif di lingkungan kantor.</li>
    </ul>

    <h5>Tanggung Jawab</h5>
    <ul>
      <li>Memastikan ketepatan, kerapian, dan akurasi data pada pekerjaan akuntansi yang menjadi tanggung jawabnya.</li>
      <li>Mengevaluasi hasil kerja sendiri dan memastikan output sesuai standar perusahaan.</li>
      <li>Dapat diberi tanggung jawab untuk membimbing atau mengarahkan rekan kerja lain pada tugas tertentu.</li>
      <li>Berperan menjaga kelancaran proses akuntansi pada perusahaan jasa atau dagang berskala kecil serta ETAP.</li>
    </ul>

    <p>Dengan menguasai kompetensi ini, peserta siap bekerja sebagai teknisi akuntansi pemula yang profesional, memiliki pengetahuan faktual, serta mampu memberikan kontribusi nyata dalam proses akuntansi operasional.</p>
  `;
}

// ========== SUBTOPIC DESCRIPTIONS ==========
function generateSubTopicDescription(title) {
  const descriptions = {
    "Menerapkan Prinsip Praktik Profesional dalam Bekerja": `
      <p>
        Unit kompetensi ini berfokus pada keterampilan, pengetahuan, dan sikap kerja yang diperlukan untuk memahami serta menerapkan prosedur, pedoman, kebijakan, dan standar dalam melaksanakan pekerjaan secara profesional.
      </p>

      <p>
        <strong>Menerapkan Prinsip Praktik Profesional dalam Bekerja</strong> mencakup pemahaman tentang fondasi sikap profesional di lingkungan akuntansi. Profesi ini tidak sekadar berkaitan dengan angka, tetapi menuntut integritas, objektivitas, dan kompetensi berkelanjutan. Anda akan mempelajari bagaimana struktur industri akuntansi bekerja, mulai dari Kantor Akuntan Publik (KAP), internal audit, hingga peran accounting officer di berbagai jenis organisasi.
      </p>

      <p>
        Selain itu, unit ini membahas penerapan standar profesi seperti Kode Etik IAI, Standar Akuntansi Keuangan (SAK), dan Standard Operating Procedure (SOP) perusahaan. Anda juga akan belajar mengelola waktu, tugas, dan prioritas kerja secara efektif untuk menghadapi deadline yang ketat—sebuah kemampuan yang sangat dibutuhkan dalam dunia profesional.
      </p>

      <ul>
        <li>Pemetaan tugas dan tanggung jawab profesi akuntansi di sektor publik, privat, pemerintahan, dan akademik</li>
        <li>Penerapan SOP, pedoman kerja, dan work instruction dalam aktivitas operasional harian</li>
        <li>Manajemen informasi: sistem pengarsipan, retensi dokumen, dan keamanan data</li>
      </ul>
    `,
    
    "Menerapkan Praktik Kesehatan dan Keselamatan di Tempat Kerja": `
      <p>
        Unit ini mencakup kompetensi yang berkaitan dengan keterampilan, pengetahuan, dan sikap kerja yang diperlukan untuk menerapkan aspek-aspek kesehatan dan keselamatan kerja (K3) di lingkungan kerja, termasuk kantor. Meski sering dianggap hanya relevan untuk industri pabrik atau konstruksi, risiko K3 juga nyata dalam aktivitas perkantoran sehari-hari.
      </p>

      <p>
        <strong>K3 di Lingkungan Kantor.</strong> Risiko seperti ergonomi yang buruk, potensi kebakaran, electrical hazard, hingga stres dan burnout dapat memengaruhi produktivitas serta kesejahteraan pekerja. Unit ini membekali Anda dengan kemampuan untuk melakukan identifikasi bahaya (hazard identification), penilaian risiko (risk assessment), dan pengendalian risiko (risk control) secara efektif.
      </p>

      <p>
        Anda juga akan mempelajari hak dan kewajiban pekerja terkait K3 sesuai peraturan perundang-undangan ketenagakerjaan, serta bagaimana menerapkan budaya kerja yang aman, sehat, dan berkelanjutan di dalam organisasi.
      </p>

      <ul>
        <li>Prosedur evakuasi darurat dan penggunaan APAR</li>
        <li>Ergonomi workstation untuk mencegah RSI (Repetitive Strain Injury)</li>
        <li>Peningkatan kesadaran kesehatan mental dan penerapan work-life balance</li>
      </ul>
    `,

    "Memproses Entry Jurnal": `
      <p>
        Unit kompetensi ini berhubungan dengan keterampilan, pengetahuan, dan sikap kerja yang dibutuhkan dalam memproses entri jurnal sebagai bagian awal dari siklus akuntansi. Ketelitian pada tahap ini sangat penting karena setiap kesalahan dapat berpengaruh hingga tahap penyusunan laporan keuangan.
      </p>

      <p>
        <strong>Pintu Masuk Sistem Akuntansi.</strong> Semua proses akuntansi dimulai dari pencatatan jurnal. Dalam unit ini, Anda akan mempelajari bagaimana memverifikasi dokumen sumber seperti invoice, receipt, dan payment voucher; mengidentifikasi akun yang terpengaruh; serta melakukan pencatatan dengan prinsip double-entry yang benar.
      </p>

      <p>
        Tidak hanya transaksi rutin, pembelajaran juga mencakup penanganan transaksi khusus seperti retur, diskon, allowance, dan adjustment entries. Anda juga akan diperkenalkan pada pentingnya dokumentasi yang baik dan pembuatan audit trail yang memenuhi prinsip pengendalian internal.
      </p>

      <ul>
        <li>Verifikasi kelengkapan dan keabsahan dokumen sumber</li>
        <li>Penentuan akun (account determination) dan pemberian kode yang tepat</li>
        <li>Pencatatan pada jurnal umum dan jurnal khusus (sales, purchase, cash receipt, cash payment)</li>
        <li>Sistem filing dan archiving yang sesuai dengan kebijakan retensi dokumen</li>
      </ul>
    `,

    "Memproses Buku Besar": `
      <p>
        Unit kompetensi ini berkaitan dengan keterampilan, pengetahuan, dan sikap kerja yang dibutuhkan dalam memproses buku besar sesuai dengan prosedur yang berlaku di perusahaan. Tahap ini merupakan bagian penting dalam siklus akuntansi karena buku besar menjadi dasar untuk penyusunan laporan keuangan.
      </p>

      <p>
        <strong>Centralized Ledger System.</strong> Buku besar merupakan pusat informasi dari seluruh transaksi akuntansi. Di tahap ini, transaksi yang telah dicatat dalam jurnal diposting ke akun-akun yang relevan. Anda akan mempelajari cara melakukan pemeliharaan (maintain) buku besar baik secara manual maupun menggunakan software akuntansi.
      </p>

      <p>
        Unit ini juga membahas teknik balancing dan reconciliation untuk memastikan kesesuaian antara debit dan kredit. Anda akan memahami struktur chart of accounts (COA) serta bagaimana melakukan penyesuaian atau customisasi COA sesuai kebutuhan operasional sebuah bisnis.
      </p>

      <ul>
        <li>Setup dan pemeliharaan chart of accounts dengan struktur hierarki yang tepat</li>
        <li>Proses posting dari jurnal ke general ledger</li>
        <li>Penyusunan trial balance dan pengecekan ketelitian perhitungan</li>
        <li>Pelaksanaan prosedur month-end closing</li>
      </ul>
    `,

    "Menyusun Laporan Keuangan": `
      <p>
        Unit kompetensi ini berkaitan dengan keterampilan, pengetahuan, dan sikap kerja yang dibutuhkan dalam menyusun laporan keuangan akhir periode sesuai dengan ketentuan SOP, SAK, maupun SAK ETAP. Tahap ini merupakan puncak dari seluruh proses akuntansi dan menjadi dasar bagi pengambilan keputusan manajerial.
      </p>

      <p>
        <strong>Financial Reporting Excellence.</strong> Dalam unit ini, Anda akan mempelajari penyusunan lima komponen laporan keuangan lengkap, yaitu: Laporan Posisi Keuangan (Neraca), Laporan Laba Rugi Komprehensif, Laporan Perubahan Ekuitas, Laporan Arus Kas, serta Catatan atas Laporan Keuangan. Kemampuan menyusun laporan keuangan secara tepat, akurat, dan sesuai standar merupakan kompetensi utama yang ditargetkan.
      </p>

      <p>
        Anda juga akan memahami konsep fundamental seperti accrual basis vs cash basis, matching principle, dan revenue recognition. Selain itu, Anda akan mempelajari penyusunan adjusting entries dan closing entries secara benar, termasuk perlakuan akuntansi untuk prepaid expenses, accrued revenues, unearned revenues, dan accrued expenses.
      </p>

      <ul>
        <li>Penyusunan adjusting journal entries di akhir periode</li>
        <li>Preparation dan penyajian financial statements sesuai SAK/SAK ETAP</li>
        <li>Pembuatan closing entries untuk temporary accounts</li>
        <li>Penyusunan post-closing trial balance sebagai dasar periode selanjutnya</li>
      </ul>
    `,

    "Mengoperasikan Paket Program Pengolah Angka / Spreadsheet": `
      <p>
        Unit kompetensi ini berkaitan dengan keterampilan, pengetahuan, dan sikap kerja yang dibutuhkan dalam mengoperasikan paket program pengolah angka (spreadsheet) sesuai dengan prosedur yang ditetapkan perusahaan. Penguasaan spreadsheet menjadi kemampuan fundamental bagi staf akuntansi dalam melakukan perhitungan, analisis, dan penyajian data secara efektif.
      </p>

      <p>
        <strong>Excel for Accountants.</strong> Di era digital, spreadsheet menjadi "second brain" bagi akuntan. Unit ini tidak hanya membahas dasar-dasar Excel, tetapi juga bagaimana memanfaatkan fitur-fitur lanjutan untuk meningkatkan efisiensi kerja, seperti VLOOKUP/XLOOKUP, INDEX–MATCH, Pivot Table, Power Query, dan bahkan VBA dasar untuk automasi.
      </p>

      <p>
        Anda akan mempelajari cara membuat template yang reusable, financial models, dan dashboard laporan. Selain itu, unit ini juga menekankan pentingnya error checking dan data validation untuk memastikan akurasi dan reliabilitas data yang digunakan dalam proses akuntansi.
      </p>

      <ul>
        <li>Advanced formulas: nested IF, array formulas, dan dynamic ranges</li>
        <li>Data analysis tools: What-If Analysis, Scenario Manager, dan Solver</li>
        <li>Automasi proses berulang menggunakan Macros</li>
        <li>Best practices: cell referencing, naming ranges, dan documentations</li>
      </ul>
    `,

    "Mengoperasikan Aplikasi Komputer Akuntansi": `
      <p>
        Unit kompetensi ini berkaitan dengan keterampilan, pengetahuan, dan sikap kerja yang dibutuhkan dalam mengoperasikan aplikasi komputer akuntansi sesuai dengan prosedur yang ditetapkan perusahaan. Penguasaan software akuntansi menjadi kompetensi penting dalam memastikan proses pencatatan, pengolahan data, dan pelaporan dapat berjalan secara efektif dan akurat.
      </p>

      <p>
        <strong>Integrated Accounting Software.</strong> Perusahaan modern umumnya menggunakan sistem ERP atau aplikasi akuntansi terintegrasi untuk mendukung proses bisnis. Dalam unit ini, Anda akan mempelajari cara mengoperasikan berbagai software akuntansi populer seperti MYOB, Zahir, Accurate, maupun SAP.
      </p>

      <p>
        Pembelajaran mencakup seluruh proses mulai dari setup awal perusahaan, penyusunan struktur Chart of Accounts (COA), input opening balances, hingga proses transaksi harian, closing, dan pelaporan. Selain itu, Anda juga akan mempelajari penanganan masalah umum (troubleshooting) serta prosedur pengelolaan data seperti backup dan restore.
      </p>

      <ul>
        <li>Initial setup: company profile, fiscal year, COA, dan linked accounts</li>
        <li>Transaction processing: purchases, sales, banking, dan inventory</li>
        <li>Penyusunan dan kustomisasi laporan sesuai kebutuhan perusahaan</li>
        <li>Pengelolaan data: data integrity, security, backup, dan restore</li>
      </ul>
    `,
  };

  return descriptions[title] || `<p>Unit kompetensi ini mencakup keterampilan, pengetahuan, dan sikap kerja yang dibutuhkan dalam ${title.toLowerCase()}.</p>`;
}