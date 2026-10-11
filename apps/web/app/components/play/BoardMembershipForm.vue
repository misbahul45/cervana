<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useBoardMembership, useGamifyMe } from '~/composables/useGamify';
import { toMembershipMessage } from '~/lib/board';

const { data: me } = useGamifyMe();
const membership = useBoardMembership();
const handle = ref('');
const notice = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);
const optedIn = computed(() => me.value?.board.optedIn ?? false);

watch(
  () => me.value?.board.handle,
  (value) => {
    if (value && !handle.value) handle.value = value;
  },
  { immediate: true },
);

async function save(optIn: boolean) {
  notice.value = null;
  const clean = handle.value.trim();
  const res = await membership.mutateAsync({ optIn, ...(clean ? { handle: clean } : {}) });
  notice.value = toMembershipMessage(res);
}
</script>

<template>
  <PlayCard tone="soft" as="section" aria-labelledby="board-join-title">
    <h2 id="board-join-title" class="rc-h2">{{ optedIn ? 'Kamu ikut papan peringkat' : 'Ikut papan peringkat' }}</h2>
    <p class="rc-hint">Pilih nama panggilan 3 sampai 20 huruf kecil, angka, atau garis bawah. Nama aslimu tidak pernah ditampilkan.</p>
    <form class="rc-row rc-board-form" @submit.prevent="save(true)">
      <label class="rc-board-form__field">
        <span class="rc-label">Nama panggilan</span>
        <input v-model="handle" class="rc-field" type="text" autocomplete="off" maxlength="20" placeholder="budi_01" />
      </label>
      <PlayButton type="submit" :loading="membership.isPending.value" :disabled="handle.trim().length < 3">{{ optedIn ? 'Simpan' : 'Ikut serta' }}</PlayButton>
      <PlayButton v-if="optedIn" variant="outline" :loading="membership.isPending.value" @click="save(false)">Keluar dari papan</PlayButton>
    </form>
    <p v-if="notice" class="rc-hint" :class="notice.tone === 'danger' && 'rc-error-text'" role="status">{{ notice.text }}</p>
  </PlayCard>
</template>

<style>
.rc-board-form {
  align-items: flex-end;
  margin-top: 0.75rem;
}

.rc-board-form__field {
  flex: 1;
  min-width: 12rem;
}

.rc-error-text {
  color: var(--rc-danger);
  font-weight: 800;
}
</style>
