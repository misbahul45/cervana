# 2026-10-03 — Public Asset Audit & Logo Refresh Design

## Goal

Hapus aset publik yang tidak dipakai dan samakan logo header dengan `public/logo.png` yang baru ditambahkan, sekaligus menutup broken reference ke `/favicon.png` di lima halaman auth/topics.

## Context

Repo saat ini sedang transisi brand: `pictures/logo.svg` sudah dihapus dari git index, lalu `logo.png` (2048×768) ditambahkan ke `apps/web/public/logo.png` — tapi tidak ada kode yang memfilenya. Hasilnya `Header.vue` masih merujuk path lama dan logo header rusak.

Bersamaan dengan itu, repositori menumpuk aset publik besar (planet SVGs, stars textures, loading, favicon.svg duplikat) yang tidak pernah dipanggil oleh komponen Vue mana pun. Membersihkan aset-aset ini menurunkan ukuran repo dan menghilangkan gambar mati yang mudah keliru diasumsikan dipakai.

## Decision

### 1. Header.vue pakai logo.png

Ganti satu baris di `apps/web/app/components/layout/Header.vue`:

```diff
- src="/pictures/logo.svg"
+ src="/logo.png"
```

Container `w-32 h-10` (8:2.5) cocok dengan aspect ratio logo PNG (2048×768 ≈ 8:3). `@nuxt/image` akan mem-fit dengan rapi. Class `w-28 absolute inset-0 top-3 m-auto` dipertahankan.

### 2. Hapus 12 aset publik tanpa referensi

Hapus via `rm` (bukan `git rm` — sesuai `AGENTS.md`, owner yang melakukan staging):

```
apps/web/public/pictures/blackhole.svg
apps/web/public/pictures/bloodmoon.svg
apps/web/public/pictures/earth.svg
apps/web/public/pictures/emerald.svg
apps/web/public/pictures/mercury.svg
apps/web/public/pictures/neptune.svg
apps/web/public/pictures/saturn.svg
apps/web/public/pictures/home/hero.svg
apps/web/public/textures/stars-big.jpg
apps/web/public/textures/stars-small.jpg
apps/web/public/loading/loading-1.svg
apps/web/public/favicon.svg
```

Verifikasi “tidak dipakai”:

- `grep -rn "pictures/blackhole\|pictures/bloodmoon\|pictures/earth\|pictures/emerald\|pictures/mercury\|pictures/neptune\|pictures/saturn\|pictures/home/hero" apps/web/app apps/web/components` → tidak ada hit
- `grep -rn "textures/\|loading-1" apps/web/app apps/web/components` → tidak ada hit
- `grep -n "favicon.svg" apps/web/nuxt.config.ts` → tidak ada hit (config pakai `icon.svg`)
- `Blackhole.vue` adalah komponen CSS-only, tidak mengimpor `pictures/blackhole.svg`

Aset yang dipakai dan tidak disentuh:

- `pictures/home/features/{ai,game,learn,quiz,eval}.svg` — dipakai `FeatureSection.vue:109-137`
- `sounds/{open-music,main-music}.mp3` — dipakai `learning.vue:129` dan `my-learning/topics/[slug]/index.vue:23`
- `images/seo/reducera-preview.png` — dipakai `nuxt.config.ts:14,19`
- `favicon.ico`, `favicon-32x32.png`, `favicon-96x96.png`, `icon.svg`, `apple-touch-icon.png` — dipakai `nuxt.config.ts:25-29`
- `site.webmanifest` — dipakai `nuxt.config.ts:30`
- `fonts/Ubuntu/Ubuntu-{Regular,Bold,Medium}.ttf` — dipakai `nuxt.config.ts:31-32` dan `main.css:131,157,171`
- `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png` — dipakai `site.webmanifest`

### 3. Fix broken `/favicon.png` di lima halaman

Ganti `href: '/favicon.png'` → `href: '/favicon-32x32.png'` di:

```
apps/web/app/pages/(auth)/login.vue:60
apps/web/app/pages/(auth)/register.vue:61
apps/web/app/pages/(auth)/forgot-password.vue:35
apps/web/app/pages/(auth)/verify-email.vue:106
apps/web/app/pages/learn/topics/index.vue:39
```

Alasan pilih `favicon-32x32.png`: file ini sudah dipakai oleh `nuxt.config.ts:26`, dan ukurannya paling cocok untuk tab-icon use case. Alternatif `icon.svg` ditolak karena tidak konsisten dengan head config global.

## Out of Scope

- `app/components/brand/BrandLogo.vue` tidak dipakai, tapi tidak disentuh (owner putuskan terpisah)
- Tidak mengubah entry `nuxt.config.ts` favicon references
- Tidak menambah atau memodifikasi `app.config.ts`/`main.css`
- Tidak mengubah konfigurasi Docker/compose

## Verification

1. **Build check** — `pnpm --filter web build` start (atau `docker compose up -d --build web` untuk full stack) — harus selesai tanpa error terkait path hilang.
2. **Static reference grep**
   - `grep -rn "pictures/.*\.svg\|textures/\|loading-1\|favicon\.svg" apps/web/app apps/web/components apps/web/pages` → kosong
   - `grep -rn "favicon\.png" apps/web/app apps/web/components apps/web/pages` → kosong
   - `grep -rn "pictures/logo\.svg" apps/web/app apps/web/components apps/web/pages` → kosong
3. **Header visual smoke** — Playwright snapshot di `http://localhost/`:
   - `<header>` memuat `<img>` (NuxtImg) dengan `src` mengandung `logo.png`
   - Network request ke `/logo.png` mengembalikan `200`
   - Tidak ada 404 untuk `pictures/logo.svg`, `textures/*`, `loading-1.svg`, atau `favicon.svg`
4. **Auth pages smoke** — buka `/login`, `/register`, `/forgot-password`, `/verify-email`, `/learn/topics`:
   - Tidak ada 404 untuk `/favicon.png`
   - `<link rel="icon">` merujuk path yang exist (cek network log)

## Risks

- **R1: `BrandLogo.vue` punya inline SVG yang akan jadi misleading.** Komponen ini tidak dipakai di source code (hanya auto-registered di `.nuxt/types/components.d.ts` build cache), tapi masih bisa diimpor manual nanti. Out of scope, tapi dicatat di laporan akhir sebagai catatan.
- **R2: Audit dilakukan statis via grep.** Dynamic import via string concatenation atau `useImage()` dengan path dinamis bisa terlewat. Risiko rendah karena codebase kecil dan semua gambar dipakai via string literal di template.
- **R3: Git working tree sudah punya dua perubahan yang belum di-commit:**
  - `deleted: apps/web/public/pictures/logo.svg`
  - `untracked: apps/web/public/logo.png`

  Task ini akan menambah perubahan lagi (modifikasi Header.vue, 5 halaman auth/topics, dan 12 file dihapus). Owner yang memutuskan apakah digabung satu commit atau dipisah.

## Completion Condition

- Header.vue memakai `/logo.png`
- 12 aset publik tanpa referensi terhapus dari filesystem
- 5 halaman auth/topics pakai `/favicon-32x32.png`
- Tidak ada 404 untuk path yang dihapus/diganti saat full stack dijalankan
- Laporan perubahan ke owner (file modified, file deleted, file yang sengaja tidak disentuh)