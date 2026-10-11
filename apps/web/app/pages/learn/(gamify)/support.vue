<script setup lang="ts">
definePageMeta({ title: 'Bantuan — ReduCera', protection: { kind: 'authenticated' } });
useHead({ title: 'Bantuan — ReduCera' });

const faqs: ReadonlyArray<{ q: string; a: string }> = [
  { q: 'Dari mana XP berasal?', a: 'XP hanya diberikan untuk penguasaan yang terbukti: kemajuan skor sebuah konsep dan bonus saat konsep itu lulus. Menyelesaikan langkah, login, atau mengobrol dengan tutor tidak memberi XP.' },
  { q: 'Kapan sebuah konsep dianggap lulus?', a: 'Skor penguasaanmu mencapai 0,7 atau lebih dengan sedikitnya tiga bukti penilaian. Satu penilaian saja belum cukup.' },
  { q: 'Bagaimana streak dihitung?', a: 'Satu hari dihitung bila kamu menyelesaikan sedikitnya satu penilaian yang menghasilkan bukti belajar, menurut zona waktu akunmu. Tujuh hari beruntun memberi bonus XP dan satu pembeku streak (maksimal dua).' },
  { q: 'Apa itu bintang?', a: 'Satu bintang untuk setiap sub-topik yang seluruh konsepnya sudah lulus. Bintang hanya ditampilkan dan belum bisa dibelanjakan.' },
  { q: 'Mengapa saya tidak ada di papan peringkat?', a: 'Papan peringkat bersifat opsional. Ikut serta di halaman Peringkat dengan nama panggilan; nama aslimu tidak pernah tampil. Peringkat dihitung dari konsep yang pertama kali kamu lulus minggu ini di sebuah topik.' },
  { q: 'Dari mana ikon dan warna berasal?', a: 'Dari tema yang tersimpan di database. Tema bawaan bernama Play; setiap ikon gamifikasi (streak, XP, bintang, level, lencana) bisa diganti oleh tema lain.' },
];
</script>

<template>
  <div>
    <PageHeader title="Cara kerja gamifikasi" subtitle="Aturan di sini sama dengan yang dijalankan sistem. Tidak ada hadiah untuk sekadar aktif." />

    <div class="rc-stack" style="--rc-stack-gap: 0.75rem">
      <PlayCard v-for="item in faqs" :key="item.q" as="details" class="rc-faq" :flat="true">
        <summary class="rc-faq__q">{{ item.q }}</summary>
        <p class="rc-faq__a">{{ item.a }}</p>
      </PlayCard>
    </div>
  </div>
</template>

<style>
.rc-faq__q {
  cursor: pointer;
  font-size: 1.0625rem;
  font-weight: 800;
}

.rc-faq__a {
  margin: 0.75rem 0 0;
  color: var(--rc-muted);
}
</style>
