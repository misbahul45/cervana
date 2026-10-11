<script setup lang="ts">
definePageMeta({ title: 'Pengaturan — ReduCera', protection: { kind: 'authenticated' } });
useHead({ title: 'Pengaturan — ReduCera' });

const colorMode = useColorMode();
const defaultTheme = useState<{ theme: { title: string; description?: string } } | null>('rc-default-theme', () => null);

const modes: ReadonlyArray<{ id: 'light' | 'dark' | 'system'; label: string }> = [
  { id: 'light', label: 'Terang' },
  { id: 'dark', label: 'Gelap' },
  { id: 'system', label: 'Ikuti perangkat' },
];
</script>

<template>
  <div>
    <PageHeader title="Pengaturan" subtitle="Atur tampilan dan privasi papan peringkat." />

    <div class="rc-stack" style="--rc-stack-gap: 1.25rem">
      <PlayCard as="section" aria-labelledby="look-title">
        <h2 id="look-title" class="rc-h2">Tampilan</h2>
        <p class="rc-hint">Tema mengatur warna dan ikon gamifikasi. Saat ini: <strong>{{ defaultTheme?.theme.title ?? 'Play' }}</strong>.</p>
        <div class="rc-row" role="group" aria-label="Mode warna" style="margin-top: 0.75rem">
          <button v-for="mode in modes" :key="mode.id" type="button" class="rc-chip rc-filter__chip" :class="colorMode.preference === mode.id && 'rc-chip--info'" :aria-pressed="colorMode.preference === mode.id" @click="colorMode.preference = mode.id">
            {{ mode.label }}
          </button>
        </div>
      </PlayCard>

      <BoardMembershipForm />

      <PlayCard as="section" aria-labelledby="account-title">
        <h2 id="account-title" class="rc-h2">Akun</h2>
        <p class="rc-hint">Ubah nama, foto, dan kata sandi di halaman profil lengkap.</p>
        <PlayButton to="/profile" variant="outline" size="sm" style="margin-top: 0.75rem">Buka profil lengkap</PlayButton>
      </PlayCard>
    </div>
  </div>
</template>
