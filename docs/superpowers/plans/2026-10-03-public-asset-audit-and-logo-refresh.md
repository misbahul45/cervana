# Public Asset Audit & Logo Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus 12 aset publik tanpa referensi, pasang `/logo.png` di Header.vue, dan ganti 5 referensi broken `/favicon.png` ke `/favicon-32x32.png`.

**Architecture:** Empat task tematik (logo, asset cleanup, favicon fix, verifikasi). Tiap task berdiri sendiri dengan test/verification gate sendiri. Agent tidak menyentuh git staging/commit — owner yang melakukannya setelah plan selesai (sesuai AGENTS.md).

**Tech Stack:** Nuxt 3 + Vue 3 + `@nuxt/image` (NuxtImg), Bash + ripgrep untuk verifikasi statis, Playwright MCP untuk smoke UI.

## Global Constraints

Sesuai `apps/web/AGENTS.md` dan root `AGENTS.md`:

- **Git constraint:** Agent **tidak boleh** menjalankan `git add`, `git commit`, `git rm`, atau mutasi git lainnya. Penghapusan file tracked menggunakan `rm` polos. Commit step di akhir plan adalah instruksi untuk owner, bukan untuk agent.
- **Path convention:** Aset di `apps/web/public/` di-serve pada path root `/`. Folder `pictures/`, `textures/`, `loading/`, `fonts/`, `sounds/`, `images/`, `icons/` adalah public static dirs.
- **Header sizing:** Logo PNG 2048×768 (~8:3) masuk container `w-32 h-10` (8:2.5) dengan class `w-28 absolute inset-0 top-3 m-auto`. Tidak butuh ubah class wrapper.
- **Spec doc:** `docs/superpowers/specs/2026-10-03-public-asset-audit-and-logo-refresh-design.md` adalah sumber kebenaran requirement.

---

### Task 1: Pasang `/logo.png` di Header.vue

**Files:**
- Modify: `apps/web/app/components/layout/Header.vue:12`

**Interfaces:**
- Reads: `apps/web/public/logo.png` (sudah ada dari perubahan owner sebelumnya).
- Produces: Header yang tidak lagi request `/pictures/logo.svg`.

- [ ] **Step 1: Verifikasi logo.png ada di filesystem**

Run: `ls -la /home/misbahul45/code/reducera/apps/web/public/logo.png`

Expected: file ada, ukuran ~329KB.

- [ ] **Step 2: Baca Header.vue untuk konfirmasi line 12**

Run: `sed -n '10,16p' /home/misbahul45/code/reducera/apps/web/app/components/layout/Header.vue`

Expected: baris 12 berisi persis `src="/pictures/logo.svg"`.

- [ ] **Step 3: Edit Header.vue**

Ganti baris 12 dari `src="/pictures/logo.svg"` menjadi `src="/logo.png"`. Pertahankan semua baris lain dan indentasi (8 spasi di dalam `<div class="relative w-32 h-10">`).

Diff file: `apps/web/app/components/layout/Header.vue`
```diff
         <NuxtImg
-          src="/pictures/logo.svg"
+          src="/logo.png"
           class="w-28 absolute inset-0 top-3 m-auto"
         />
```

- [ ] **Step 4: Verifikasi tidak ada referensi ke `pictures/logo.svg` lagi**

Run: `grep -rn "pictures/logo\.svg" /home/misbahul45/code/reducera/apps/web/app /home/misbahul45/code/reducera/apps/web/components /home/misbahul45/code/reducera/apps/web/pages 2>&1 | grep -v node_modules`

Expected: kosong (zero matches).

- [ ] **Step 5: Verifikasi Header.vue baru berisi `src="/logo.png"`**

Run: `grep -n "logo\.png\|logo\.svg" /home/misbahul45/code/reducera/apps/web/app/components/layout/Header.vue`

Expected: satu match pada line 12: `src="/logo.png"`.

---

### Task 2: Hapus 12 aset publik tanpa referensi

**Files:**
- Delete (via `rm` polos, bukan `git rm`): 12 path di bawah.

**Interfaces:**
- Pre-condition: Task 1 selesai, supaya grep di Step 1 tidak memunculkan false negative dari header yang masih referensi path terhapus.
- Produces: filesystem bersih dari 12 aset mati; `git status` menampilkan 12 entri `deleted`.

- [ ] **Step 1: Verifikasi tidak ada referensi ke 12 aset di source code**

Jalankan semua perintah di bawah dan harus **kosong**:

```bash
cd /home/misbahul45/code/reducera
grep -rn "pictures/blackhole\|pictures/bloodmoon\|pictures/earth\|pictures/emerald\|pictures/mercury\|pictures/neptune\|pictures/saturn\|pictures/home/hero" apps/web/app apps/web/components apps/web/pages 2>&1 | grep -v node_modules
grep -rn "textures/" apps/web/app apps/web/components apps/web/pages 2>&1 | grep -v node_modules
grep -rn "loading-1" apps/web/app apps/web/components apps/web/pages 2>&1 | grep -v node_modules
grep -n "favicon\.svg" apps/web/nuxt.config.ts
```

Expected: semua command exit 0 dengan output kosong.

- [ ] **Step 2: Verifikasi Blackhole.vue tidak mengimpor pictures/blackhole.svg**

Run: `grep -n "import\|src=" /home/misbahul45/code/reducera/apps/web/app/components/ui/Blackhole.vue`

Expected: tidak ada baris yang mereferensikan `blackhole.svg` atau path apapun di `pictures/`. (Komponen ini CSS-only.)

- [ ] **Step 3: Hapus 12 file dengan `rm` polos**

```bash
cd /home/misbahul45/code/reducera
rm apps/web/public/pictures/blackhole.svg
rm apps/web/public/pictures/bloodmoon.svg
rm apps/web/public/pictures/earth.svg
rm apps/web/public/pictures/emerald.svg
rm apps/web/public/pictures/mercury.svg
rm apps/web/public/pictures/neptune.svg
rm apps/web/public/pictures/saturn.svg
rm apps/web/public/pictures/home/hero.svg
rm apps/web/public/textures/stars-big.jpg
rm apps/web/public/textures/stars-small.jpg
rm apps/web/public/loading/loading-1.svg
rm apps/web/public/favicon.svg
```

Expected: semua `rm` exit 0 (no output untuk sukses).

- [ ] **Step 4: Verifikasi filesystem bersih**

```bash
cd /home/misbahul45/code/reducera
test -f apps/web/public/pictures/blackhole.svg && echo "STILL EXISTS" || echo "OK blackhole"
test -f apps/web/public/pictures/bloodmoon.svg && echo "STILL EXISTS" || echo "OK bloodmoon"
test -f apps/web/public/pictures/earth.svg && echo "STILL EXISTS" || echo "OK earth"
test -f apps/web/public/pictures/emerald.svg && echo "STILL EXISTS" || echo "OK emerald"
test -f apps/web/public/pictures/mercury.svg && echo "STILL EXISTS" || echo "OK mercury"
test -f apps/web/public/pictures/neptune.svg && echo "STILL EXISTS" || echo "OK neptune"
test -f apps/web/public/pictures/saturn.svg && echo "STILL EXISTS" || echo "OK saturn"
test -f apps/web/public/pictures/home/hero.svg && echo "STILL EXISTS" || echo "OK hero"
test -f apps/web/public/textures/stars-big.jpg && echo "STILL EXISTS" || echo "OK stars-big"
test -f apps/web/public/textures/stars-small.jpg && echo "STILL EXISTS" || echo "OK stars-small"
test -f apps/web/public/loading/loading-1.svg && echo "STILL EXISTS" || echo "OK loading-1"
test -f apps/web/public/favicon.svg && echo "STILL EXISTS" || echo "OK favicon.svg"
```

Expected: 12 baris `OK`, 0 baris `STILL EXISTS`.

- [ ] **Step 5: Verifikasi `git status` menampilkan 12 deleted**

Run: `cd /home/misbahul45/code/reducera && git status --short | grep -c "^\s*D apps/web/public/"`

Expected: output `12`.

---

### Task 3: Fix broken `/favicon.png` di 5 halaman

**Files:**
- Modify: `apps/web/app/pages/(auth)/login.vue:60`
- Modify: `apps/web/app/pages/(auth)/register.vue:61`
- Modify: `apps/web/app/pages/(auth)/forgot-password.vue:35`
- Modify: `apps/web/app/pages/(auth)/verify-email.vue:106`
- Modify: `apps/web/app/pages/learn/topics/index.vue:39`

**Interfaces:**
- Read: `apps/web/public/favicon-32x32.png` (sudah ada, 366 bytes).
- Produces: tidak ada lagi request ke `/favicon.png` di head links.

- [ ] **Step 1: Konfirmasi file pengganti ada**

Run: `ls -la /home/misbahul45/code/reducera/apps/web/public/favicon-32x32.png`

Expected: file ada, ukuran ~366 bytes.

- [ ] **Step 2: Konfirmasi 5 halaman saat ini mereferensikan `/favicon.png`**

Run: `grep -rn "href: '/favicon\.png'" /home/misbahul45/code/reducera/apps/web/app`

Expected: tepat 5 hits di file-file berikut:
- `apps/web/app/pages/(auth)/login.vue`
- `apps/web/app/pages/(auth)/register.vue`
- `apps/web/app/pages/(auth)/forgot-password.vue`
- `apps/web/app/pages/(auth)/verify-email.vue`
- `apps/web/app/pages/learn/topics/index.vue`

- [ ] **Step 3: Edit login.vue**

File: `apps/web/app/pages/(auth)/login.vue`

Ganti line 60:
```diff
-  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
+  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
```

- [ ] **Step 4: Edit register.vue**

File: `apps/web/app/pages/(auth)/register.vue`

Ganti line 61 (pola identik dengan login.vue):
```diff
-  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
+  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
```

- [ ] **Step 5: Edit forgot-password.vue**

File: `apps/web/app/pages/(auth)/forgot-password.vue`

Ganti line 35 (pola identik):
```diff
-    { rel: 'icon', type: 'image/png', href: '/favicon.png' },
+    { rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' },
```

(Catatan: file ini mungkin tidak punya prefix `link:` pada baris yang sama — hanya objek array literal. Tetap ganti persis pola `href: '/favicon.png'` menjadi `href: '/favicon-32x32.png'`.)

- [ ] **Step 6: Edit verify-email.vue**

File: `apps/web/app/pages/(auth)/verify-email.vue`

Ganti line 106 (pola identik dengan login.vue):
```diff
-  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
+  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
```

- [ ] **Step 7: Edit learn/topics/index.vue**

File: `apps/web/app/pages/learn/topics/index.vue`

Ganti line 39 (pola identik):
```diff
-  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
+  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
```

- [ ] **Step 8: Verifikasi tidak ada lagi `/favicon.png` di source**

Run: `grep -rn "favicon\.png" /home/misbahul45/code/reducera/apps/web/app`

Expected: kosong.

- [ ] **Step 9: Verifikasi 5 file memakai `/favicon-32x32.png`**

Run: `grep -rln "favicon-32x32\.png" /home/misbahul45/code/reducera/apps/web/app`

Expected: minimal 5 file dari daftar halaman target muncul di output (boleh lebih dari 5, asalkan tidak kurang).

---

### Task 4: Verifikasi end-to-end (build, smoke)

**Files:** none modified in this task.

**Interfaces:**
- Pre-condition: Task 1, 2, 3 selesai.
- Produces: laporan "semua verifikasi lulus" atau daftar kegagalan konkret.

- [ ] **Step 1: Final grep sweep**

Jalankan ketiga grep di bawah dan harus **kosong semua**:

```bash
cd /home/misbahul45/code/reducera
grep -rn "pictures/logo\.svg\|pictures/blackhole\|pictures/bloodmoon\|pictures/earth\|pictures/emerald\|pictures/mercury\|pictures/neptune\|pictures/saturn\|pictures/home/hero" apps/web/app apps/web/components apps/web/pages apps/web/nuxt.config.ts 2>&1 | grep -v node_modules
grep -rn "textures/\|loading-1\|favicon\.svg" apps/web/app apps/web/components apps/web/pages 2>&1 | grep -v node_modules
grep -rn "/favicon\.png" apps/web/app 2>&1 | grep -v node_modules
```

Expected: ketiga command exit 0 dengan output kosong.

- [ ] **Step 2: Build check**

Run:

```bash
cd /home/misbahul45/code/reducera
docker compose up -d --build web
```

Tunggu sampai `docker compose ps` menunjukkan service `web` status `running`/`healthy` ATAU container telah jalan ≥30 detik.

Expected: build sukses, no "module not found" atau path resolution errors terkait aset publik. Cek `docker compose logs web --tail 50` untuk konfirmasi tidak ada error.

- [ ] **Step 3: HTTP smoke untuk header dan favicon (Playwright MCP)**

Gunakan Playwright MCP. Selalu tulis `.playwright-mcp/<name>.png` (folder ini git-ignored).

1. `playwright_browser_navigate` ke `http://localhost/`
2. `playwright_browser_snapshot` — verifikasi `<header>` memuat `<img>` dengan `src` mengandung `logo.png`
3. `playwright_browser_network_requests` filter `static=false` — verifikasi:
   - GET `/logo.png` → status `200`
   - Tidak ada 404 untuk `/pictures/logo.svg`, `/textures/*`, `/loading-1.svg`, `/favicon.svg`
4. `playwright_browser_take_screenshot` simpan ke `.playwright-mcp/header-after-light.png`
5. `playwright_browser_emulate_media` colorScheme `dark`, ulangi screenshot `.playwright-mcp/header-after-dark.png`
6. `playwright_browser_navigate` ke `http://localhost/login`. Snapshot, network log: tidak ada 404 untuk `/favicon.png`.
7. Ulangi untuk `/register`, `/forgot-password`, `/verify-email`, `/learn/topics`.
8. `playwright_browser_console_messages` level `error` di setiap halaman — harus kosong.

Expected: zero console error, zero 404 terkait aset, header menampilkan logo PNG.

- [ ] **Step 4: Cleanup container**

Run: `cd /home/misbahul45/code/reducera && docker compose stop web`

(Jangan `docker compose down -v` — container tetap untuk inspeksi lebih lanjut. Hati-hati AGENTS.md: tidak ada `down -v` di production tanpa konfirmasi eksplisit; ini dev mode jadi relatif aman, tapi `stop` lebih konservatif.)

- [ ] **Step 5: Laporan ke owner**

Format output ke owner:

```markdown
## Public Asset Audit & Logo Refresh — Selesai

### File yang harus di-stage + commit oleh owner

**Modified (6 file):**
- `apps/web/app/components/layout/Header.vue` — logo src ganti ke `/logo.png`
- `apps/web/app/pages/(auth)/login.vue` — favicon head link
- `apps/web/app/pages/(auth)/register.vue` — favicon head link
- `apps/web/app/pages/(auth)/forgot-password.vue` — favicon head link
- `apps/web/app/pages/(auth)/verify-email.vue` — favicon head link
- `apps/web/app/pages/learn/topics/index.vue` — favicon head link

**Deleted (12 file di `apps/web/public/`):**
- `pictures/blackhole.svg`
- `pictures/bloodmoon.svg`
- `pictures/earth.svg`
- `pictures/emerald.svg`
- `pictures/mercury.svg`
- `pictures/neptune.svg`
- `pictures/saturn.svg`
- `pictures/home/hero.svg`
- `textures/stars-big.jpg`
- `textures/stars-small.jpg`
- `loading/loading-1.svg`
- `favicon.svg`

**Untracked (sudah ada sebelumnya, di luar scope commit ini):**
- `apps/web/public/logo.png`

**Pre-existing deletion yang sudah staged (milik owner):**
- `apps/web/public/pictures/logo.svg`

### Verifikasi

- ✅ Header.vue pakai `/logo.png`
- ✅ 12 aset tanpa referensi terhapus
- ✅ 5 halaman pakai `/favicon-32x32.png`
- ✅ Final grep sweep kosong
- ✅ Build sukses
- ✅ Smoke Playwright: zero 404 terkait aset, header menampilkan logo PNG
- 📸 Screenshot tersimpan di `.playwright-mcp/header-after-{light,dark}.png`

### Catatan di luar scope (untuk info, BUKAN bagian commit ini)

- `apps/web/app/components/brand/BrandLogo.vue` ada tapi tidak pernah diimpor di source code (hanya auto-registered di `.nuxt/types/components.d.ts` build cache). Owner putuskan apakah dihapus/dibiarkan.
- `apps/web/public/pictures/home/features/{ai,game,learn,quiz,eval}.svg`, `sounds/*`, `fonts/Ubuntu/*`, `images/seo/reducera-preview.png`, `web-app-manifest-*.png` — masih dipakai, tidak disentuh.
```

---

## Self-Review Notes

- **Spec coverage:** ✅ Tujuan 1 (logo Header), Tujuan 2 (12 aset tanpa referensi), Tujuan 3 (5 favicon.png broken), verifikasi, out-of-scope, risks.
- **Placeholder scan:** tidak ada TBD/TODO. Setiap step punya perintah konkret dan expected output.
- **Type/filename consistency:** path file konsisten repo-relative; `apps/web/public/...` dan `apps/web/app/...` dipakai seragam.
- **Git constraint compliance:** tidak ada `git add`/`commit`/`rm` di step manapun. Task 4 Step 5 hanya lapor file modified + deleted untuk owner.
- **Edge case handled:**
  - `forgot-password.vue` mungkin pakai array literal tanpa `link:` prefix — Step 5 menyebutkannya eksplisit.
  - Build pakai `docker compose up -d --build` (AGENTS.md wajib pakai full stack untuk web changes).
  - Verifikasi UI pakai Playwright MCP dengan screenshot ke `.playwright-mcp/` (AGENTS.md aturan).
  - Tidak `docker compose down -v` di dev pun, hanya `stop`.