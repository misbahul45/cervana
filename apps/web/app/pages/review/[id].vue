<script setup lang="ts">
import { ref } from 'vue';

definePageMeta({
  title: 'Tinjauan Item — ReduCera',
  protection: { kind: 'capability', capability: 'REVIEWER' },
  layout: 'studio',
});

const route = useRoute();
const reviewId = computed(() => String(route.params.id || ''));

const comment = ref('');
const showConfirm = ref<'approve' | 'reject' | null>(null);

function confirm(action: 'approve' | 'reject') {
  showConfirm.value = action;
}
function proceed() {
  showConfirm.value = null;
  comment.value = '';
}
</script>

<template>
  <main id="main" aria-labelledby="review-item-h">
    <header>
      <h1 id="review-item-h">Tinjauan: Item #{{ reviewId }}</h1>
      <p>Pembuat tidak ditampilkan di sini untuk menjaga objektivitas tinjauan.</p>
    </header>

    <section class="rc-review-item__content" aria-label="Konten yang ditinjau">
      <p>
        Konten item tinjauan ada di sini. Baca dengan cermat. Keputusan Anda akan diaudit
        dan dapat diminta klarifikasinya oleh admin.
      </p>
    </section>

    <section v-if="!showConfirm" class="rc-review-item__actions">
      <button type="button" class="rc-review-item__approve" @click="confirm('approve')">
        Setujui
      </button>
      <button type="button" class="rc-review-item__reject" @click="confirm('reject')">
        Tolak
      </button>
      <button type="button" class="rc-review-item__changes">
        Minta perubahan
      </button>
    </section>

    <section v-else class="rc-review-item__confirm" aria-live="polite">
      <h2 v-if="showConfirm === 'approve'">Konfirmasi persetujuan</h2>
      <h2 v-else>Konfirmasi penolakan</h2>
      <label>
        Catatan untuk kreator
        <textarea v-model="comment" rows="3" placeholder="Jelaskan alasan keputusan Anda" />
      </label>
      <div class="rc-review-item__confirm-actions">
        <button type="button" @click="showConfirm = null">Batal</button>
        <button type="button" @click="proceed">Kirim keputusan</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.rc-review-item__content {
  padding: 1rem;
  border-radius: 0.625rem;
  background: var(--ui-bg, white);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  margin-bottom: 1rem;
}
.rc-review-item__actions {
  display: flex;
  gap: 0.5rem;
}
.rc-review-item__approve,
.rc-review-item__reject,
.rc-review-item__changes {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  cursor: pointer;
}
.rc-review-item__approve:hover { background: #dcfce7; }
.rc-review-item__reject:hover { background: #fee2e2; }
.rc-review-item__confirm {
  padding: 1rem;
  border-radius: 0.625rem;
  background: #fef3c7;
  border: 1px solid #d97706;
}
.rc-review-item__confirm textarea {
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  margin-top: 0.25rem;
}
.rc-review-item__confirm-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>