# Phase 4 — Creator Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn mastered students into published creators. Add the missing UI surface (`/become-creator`, `/studio/*`, moderation queue), wire the mastery-evidence gate, and add the `REVIEWER` capability per decision D-12. The existing `TeacherApplication`, `Article`, `ArticleVersion`, `ClassProduct` models are reused; no new Prisma models for creator entities.

**Architecture:** Reuse `services/api/src/v1/articles/article-authoring.service.ts`, `services/api/src/v1/classes/class-authoring.service.ts`, and `services/api/src/v1/teacher/applications/applications.service.ts`. Add `REVIEWER` to the `Role` enum (per D-12). Add a deterministic `CreatorEligibilityService` that checks `mastery >= 0.85` on the applicant's chosen subject. Build the missing UI: `/become-creator` form, `/studio/{articles,classes,simulations,quizzes}` routes, `/admin/moderation` queue, and `/creators/[id]` profile. MVP studio is markdown + quiz JSON upload only; rich WYSIWYG deferred to V2 (per spec §5.5 risk mitigation).

**Tech Stack:** NestJS 11, Prisma 7, Nuxt 4 SSR, Pinia (existing), pnpm.

## Global Constraints

Same as Phases 0-3. Plus:

- Approval and publication are deterministic (per spec I3 / AI-7). The LLM can recommend content; the deterministic engine decides whether to issue approval.
- Studio MVP is markdown + quiz JSON upload only (per spec §5.5 risk mitigation). Rich WYSIWYG, video upload, and interactive simulation authoring are deferred to V2.
- `REVIEWER` is a new role distinct from `TEACHER` (per D-12 in `docs/strategy/decision-register.md`). A reviewer can moderate content but is not automatically a teacher.
- Application eligibility requires `masteryScore >= 0.85` on the applicant's chosen subject. The deterministic engine checks this; the LLM does not.
- AI cannot autonomously publish content (per spec I4). Publication requires a `REVIEWER` approval row.

---

## Task 1: Audit current state of the creator economy

**Files:**
- Read: `services/api/prisma/schema.prisma` (Role enum, Article, ClassProduct, TeacherApplication)
- Read: `services/api/src/v1/teacher/applications/applications.service.ts`
- Read: `services/api/src/v1/articles/article-authoring.service.ts`
- Read: `services/api/src/v1/classes/class-authoring.service.ts`
- Read: `apps/web/app/pages/` (confirm no `/become-creator` or `/studio` routes)
- Create: `docs/progress-tracker.md` (append Phase 4 audit table)

- [ ] **Step 1: Verify existing models**

Run:
```
grep -nE "model TeacherApplication|model Article|model ArticleVersion|model ClassProduct" services/api/prisma/schema.prisma
```
Expected: all four lines present.

- [ ] **Step 2: Verify the Role enum**

Run:
```
grep -nA6 "^enum Role " services/api/prisma/schema.prisma
```
Expected: `STUDENT ADMIN TEACHER`. `REVIEWER` is missing — added in Task 2.

- [ ] **Step 3: Verify the application service accepts evidence**

Run:
```
grep -n "create\|expertise\|mastery" services/api/src/v1/teacher/applications/applications.service.ts | head -10
```
Expected: a `create()` method. The mastery-gate check is added in Task 3.

- [ ] **Step 4: Verify the article authoring service**

Run:
```
grep -n "createDraft\|publish\|moderate" services/api/src/v1/articles/article-authoring.service.ts | head -10
```
Expected: at least `createDraft()` and `publish()` (the latter likely gated on moderation).

- [ ] **Step 5: Verify web has no `/become-creator` or `/studio` routes**

Run:
```
find apps/web/app/pages -type d \( -name become-creator -o -name studio -o -name admin \)
```
Expected: `apps/web/app/pages/marketplace/creator` exists (for buyers), but no `become-creator`, no `studio`, no `admin`. (Phase 4 adds them all.)

- [ ] **Step 6: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 4 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| TeacherApplication model | PRESENT / MISSING | grep |
| Article + ArticleVersion models | PRESENT / MISSING | grep |
| ClassProduct model | PRESENT / MISSING | grep |
| Role enum has STUDENT/ADMIN/TEACHER | YES | grep |
| Role enum has REVIEWER | MISSING | grep |
| Application service create() | PRESENT | grep |
| Article authoring createDraft()/publish() | PRESENT / MISSING | grep |
| apps/web/app/pages/become-creator | MISSING | find |
| apps/web/app/pages/studio | MISSING | find |
| apps/web/app/pages/admin | MISSING | find |
```

---

## Task 2: Add `REVIEWER` to the Role enum

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_reviewer_role/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/reviewer-role-invariants.int.spec.ts`

Per D-12 in `docs/strategy/decision-register.md`. A `REVIEWER` can moderate content without becoming a teacher.

- [ ] **Step 1: Read the latest applied migration filename**

Run: `ls services/api/prisma/migrations/ | tail -1`

- [ ] **Step 2: Add REVIEWER to the enum**

Modify `services/api/prisma/schema.prisma`. Find the `Role` enum and add `REVIEWER`:

```prisma
enum Role {
  STUDENT
  ADMIN
  TEACHER
  REVIEWER
}
```

- [ ] **Step 3: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Expected: `ALTER TYPE "Role" ADD VALUE 'REVIEWER'`.

Save to `services/api/prisma/migrations/<timestamp>_reviewer_role/migration.sql` where `<timestamp>` is AFTER the latest applied.

- [ ] **Step 4: Apply on a scratch DB**

Run:
```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy
```
Expected: applies.

- [ ] **Step 5: Write the invariant test**

Create `services/api/prisma/migrations/__tests__/reviewer-role-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('REVIEWER role invariant (Phase 4)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    prisma = module.get(PrismaService);
  });

  it('allows creating a user with role REVIEWER', async () => {
    const u = await prisma.user.create({ data: { email: 'rev@test', role: 'REVIEWER' as any } });
    const found = await prisma.user.findUnique({ where: { id: u.id } });
    expect(found?.role).toBe('REVIEWER');
    await prisma.user.delete({ where: { id: u.id } });
  });

  it('still allows STUDENT/ADMIN/TEACHER (regression check)', async () => {
    const u1 = await prisma.user.create({ data: { email: 's@test', role: 'STUDENT' as any } });
    const u2 = await prisma.user.create({ data: { email: 'a@test', role: 'ADMIN' as any } });
    const u3 = await prisma.user.create({ data: { email: 't@test', role: 'TEACHER' as any } });
    expect(u1.role).toBe('STUDENT');
    expect(u2.role).toBe('ADMIN');
    expect(u3.role).toBe('TEACHER');
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id, u3.id] } } });
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/reviewer-role-invariants.int.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 3: Add the mastery-evidence gate to `TeacherApplication`

**Files:**
- Create: `services/api/src/v1/teacher/eligibility/creator-eligibility.service.ts`
- Create: `services/api/src/v1/teacher/eligibility/creator-eligibility.module.ts`
- Modify: `services/api/src/v1/teacher/applications/applications.service.ts`
- Create: `services/api/src/v1/teacher/eligibility/__tests__/creator-eligibility.service.spec.ts`

The application requires `masteryScore(topicId) >= 0.85` where `topicId` is the applicant's chosen subject. Deterministic.

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/teacher/eligibility/__tests__/creator-eligibility.service.spec.ts`:

```typescript
import { CreatorEligibilityService } from '../creator-eligibility.service';

describe('CreatorEligibilityService (deterministic)', () => {
  let service: CreatorEligibilityService;

  beforeEach(() => {
    const masteryRepo = { findByUserAndTopic: jest.fn() };
    service = new CreatorEligibilityService(masteryRepo as any);
  });

  it('returns eligible when mastery >= 0.85', async () => {
    (service as any).masteryRepo.findByUserAndTopic.mockResolvedValue({ score: 0.9 });
    const out = await service.check({ userId: 'u1', topicId: 'l1-t02-journal-keeper' });
    expect(out).toMatchObject({ eligible: true, score: 0.9 });
  });

  it('returns not-eligible when mastery below 0.85', async () => {
    (service as any).masteryRepo.findByUserAndTopic.mockResolvedValue({ score: 0.5 });
    const out = await service.check({ userId: 'u1', topicId: 'l1-t02-journal-keeper' });
    expect(out).toMatchObject({ eligible: false });
  });

  it('returns not-eligible when no mastery record', async () => {
    (service as any).masteryRepo.findByUserAndTopic.mockResolvedValue(null);
    const out = await service.check({ userId: 'u1', topicId: 'l1-t02-journal-keeper' });
    expect(out).toMatchObject({ eligible: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/teacher/eligibility/__tests__/creator-eligibility.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/teacher/eligibility/creator-eligibility.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { MasteryRepo } from '@/v1/personalization/mastery/mastery.repo';

const ELIGIBILITY_THRESHOLD = 0.85;

@Injectable()
export class CreatorEligibilityService {
  constructor(private readonly masteryRepo: MasteryRepo) {}

  async check(input: { userId: string; topicId: string }): Promise<{ eligible: boolean; score: number | null }> {
    const m = await this.masteryRepo.findByUserAndTopic(input.userId, input.topicId);
    const score = m?.score ?? null;
    return { eligible: score !== null && score >= ELIGIBILITY_THRESHOLD, score };
  }
}
```

- [ ] **Step 4: Implement the module**

Create `services/api/src/v1/teacher/eligibility/creator-eligibility.module.ts`. Register `CreatorEligibilityService`.

- [ ] **Step 5: Wire into `applications.service`**

Modify `services/api/src/v1/teacher/applications/applications.service.ts`. Inject `CreatorEligibilityService`. In the `create()` method (or wherever the application is submitted), call:

```typescript
const { eligible } = await this.eligibility.check({ userId: input.userId, topicId: input.expertise });
if (!eligible) {
  throw new BadRequestException('mastery_threshold_not_met');
}
```

`expertise` is the existing field on `TeacherApplication`; treat it as the chosen topic id for Phase 4 (the schema intent per the existing fields).

If `expertise` is free-text today, add a structured `expertiseTopicId String?` column to `TeacherApplication` (hand-written migration per AGENTS.md):

```prisma
model TeacherApplication {
  // existing fields ...
  expertiseTopicId String?
}
```

Migration: `ALTER TABLE "TeacherApplication" ADD COLUMN "expertiseTopicId" TEXT;`.

- [ ] **Step 6: Run the test**

Run: `cd services/api && pnpm jest src/v1/teacher/eligibility/__tests__/creator-eligibility.service.spec.ts --silent`
Expected: PASS, 3 tests.

- [ ] **Step 7: Run the full suite**

Run: `cd services/api && pnpm jest --silent 2>&1 | tail -3`
Expected: no new failures.

---

## Task 4: Build `/become-creator` UI (SSR-first)

**Files:**
- Create: `apps/web/app/pages/become-creator/index.vue`
- Modify: `apps/web/app/lib/api.ts` (add `becomeCreator` helper)

- [ ] **Step 1: Add the API helper**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const creatorApi = {
  apply: (body: { fullName: string; bio?: string; cvUrl?: string; portfolioUrl?: string; expertise: string; expertiseTopicId: string; experiences: Array<{ title: string; institution?: string; startDate: string; endDate?: string; description?: string }>; certifications: Array<{ name: string; issuer?: string; issuedDate?: string; credentialUrl?: string }> }, token?: string) =>
    request<TeacherApplication>(`${API}/v1/teacher/applications`, { method: 'POST', body, token }),
  checkEligibility: (topicId: string, token?: string) =>
    request<{ eligible: boolean; score: number | null }>(`${API}/v1/teacher/eligibility?topicId=${encodeURIComponent(topicId)}`, { token }),
};
```

The eligibility endpoint is added in Task 5 if not present.

- [ ] **Step 2: Implement the page**

Create `apps/web/app/pages/become-creator/index.vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const topicId = computed(() => String(route.query.topicId ?? ''));
const { data: eligibility } = await useFetch(() => `/api/v1/teacher/eligibility?topicId=${topicId.value}`, {
  headers: useRequestHeaders(['cookie']),
  server: true,
  watch: [topicId],
});

const form = reactive({
  fullName: '',
  bio: '',
  cvUrl: '',
  portfolioUrl: '',
  expertise: topicId.value,
  expertiseTopicId: topicId.value,
  experiences: [] as Array<{ title: string; institution?: string; startDate: string; endDate?: string; description?: string }>,
  certifications: [] as Array<{ name: string; issuer?: string; issuedDate?: string; credentialUrl?: string }>,
});
const submitting = ref(false);
const error = ref<string | null>(null);

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    await creatorApi.apply(form);
    navigateTo('/my-learning/become-creator/success');
  } catch (e: any) {
    error.value = e?.message ?? 'submit_failed';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Jadi Kreator — ReduCera' });
</script>

<template>
  <main>
    <h1>Jadi Kreator ReduCera</h1>
    <p v-if="!eligibility?.eligible" class="eligibility-warning">
      Anda belum eligible. Selesaikan topik dengan skor >= 85% terlebih dahulu.
    </p>
    <form v-else @submit.prevent="submit">
      <label> Nama lengkap <input v-model="form.fullName" required /> </label>
      <label> Topik keahlian (topic id) <input v-model="form.expertiseTopicId" required /> </label>
      <label> Bio <textarea v-model="form.bio" /> </label>
      <label> URL CV <input v-model="form.cvUrl" type="url" /> </label>
      <label> URL Portofolio <input v-model="form.portfolioUrl" type="url" /> </label>
      <fieldset>
        <legend>Pengalaman</legend>
        <div v-for="(exp, i) in form.experiences" :key="i">
          <input v-model="exp.title" placeholder="Judul" required />
          <input v-model="exp.institution" placeholder="Institusi" />
          <input v-model="exp.startDate" type="date" />
          <input v-model="exp.endDate" type="date" />
        </div>
        <button type="button" @click="form.experiences.push({ title: '', startDate: new Date().toISOString().slice(0, 10) })">
          Tambah pengalaman
        </button>
      </fieldset>
      <fieldset>
        <legend>Sertifikasi</legend>
        <div v-for="(cert, i) in form.certifications" :key="i">
          <input v-model="cert.name" placeholder="Nama" required />
          <input v-model="cert.issuer" placeholder="Penerbit" />
          <input v-model="cert.issuedDate" type="date" />
        </div>
        <button type="button" @click="form.certifications.push({ name: '' })">Tambah sertifikasi</button>
      </fieldset>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Mengirim…' : 'Kirim Lamaran' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </main>
</template>
```

- [ ] **Step 3: Add the eligibility endpoint**

Modify `services/api/src/v1/teacher/eligibility/creator-eligibility.controller.ts` (or new file). Expose `GET /v1/teacher/eligibility?topicId=...`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { CreatorEligibilityService } from './creator-eligibility.service';

@Controller('v1/teacher/eligibility')
@UseGuards(JwtAuthGuard)
export class CreatorEligibilityController {
  constructor(private readonly eligibility: CreatorEligibilityService) {}

  @Get()
  check(@CurrentUser() user: { id: string }, @Query('topicId') topicId: string) {
    return this.eligibility.check({ userId: user.id, topicId });
  }
}
```

Register in the module.

- [ ] **Step 4: Add the success page**

Create `apps/web/app/pages/my-learning/become-creator/success.vue`:

```vue
<script setup lang="ts">
useHead({ title: 'Lamaran Terkirim — ReduCera' });
</script>

<template>
  <main>
    <h1>Lamaran Terkirim</h1>
    <p>Lamaran Anda akan ditinjau oleh tim ReduCera. Kami akan menghubungi Anda melalui email.</p>
    <NuxtLink to="/my-learning">Kembali ke Beranda Belajar</NuxtLink>
  </main>
</template>
```

- [ ] **Step 5: Verify SSR**

Run: `docker compose up -d --build web api`
Then: `curl -fsS http://localhost/become-creator | grep -E "Jadi Kreator|eligibility-warning"`
Expected: at least the H1 is present in the first response; the eligibility warning text appears if the user has no qualifying mastery.

- [ ] **Step 6: Run the Playwright MCP matrix at viewports 375x812, 768x1024, 1280x800 × both color schemes × `reducedMotion: reduce` once.

Screenshots to `.playwright-mcp/phase-4-become-creator-{viewport}-{scheme}.png`.

---

## Task 5: Build `/studio/*` UI (SSR-first)

**Files:**
- Create: `apps/web/app/pages/studio/index.vue` (creator dashboard)
- Create: `apps/web/app/pages/studio/articles/index.vue`
- Create: `apps/web/app/pages/studio/articles/new.vue`
- Create: `apps/web/app/pages/studio/articles/[id].vue`
- Create: `apps/web/app/pages/studio/classes/index.vue`
- Create: `apps/web/app/pages/studio/classes/new.vue`
- Create: `apps/web/app/pages/studio/classes/[id].vue`
- Modify: `apps/web/app/lib/api.ts` (add studio helpers)

MVP scope: markdown for articles, JSON for quizzes, simple session fields for classes. No rich WYSIWYG (per spec §5.5 risk mitigation).

- [ ] **Step 1: Add the API helpers**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const studioApi = {
  listArticles: (token?: string) => request<Article[]>(`${API}/v1/articles/mine`, { token }),
  createArticle: (body: { title: string; body: string; topicId: string }, token?: string) =>
    request<Article>(`${API}/v1/articles`, { method: 'POST', body, token }),
  listClasses: (token?: string) => request<ClassProduct[]>(`${API}/v1/classes/mine`, { token }),
  createClass: (body: { title: string; description: string; topicId: string; sessions: Array<{ title: string; scheduledAt: string }> }, token?: string) =>
    request<ClassProduct>(`${API}/v1/classes`, { method: 'POST', body, token }),
  submitForReview: (kind: 'article' | 'class', id: string, token?: string) =>
    request<{ status: string }>(`${API}/v1/${kind === 'article' ? 'articles' : 'classes'}/${id}/submit`, { method: 'POST', token }),
};
```

If `articles/mine` and `classes/mine` endpoints don't exist, add them. The existing authoring controllers may already have `list` methods; if so, filter by `authorId = currentUser.id`.

- [ ] **Step 2: Implement the studio dashboard**

Create `apps/web/app/pages/studio/index.vue`:

```vue
<script setup lang="ts">
const { data: articles } = await useFetch('/api/v1/articles/mine', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const { data: classes } = await useFetch('/api/v1/classes/mine', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

useHead({ title: 'Studio Kreator — ReduCera' });
</script>

<template>
  <main>
    <h1>Studio</h1>
    <nav class="studio-nav">
      <NuxtLink to="/studio/articles">Artikel</NuxtLink>
      <NuxtLink to="/studio/classes">Kelas</NuxtLink>
      <NuxtLink to="/studio/simulations">Simulasi</NuxtLink>
      <NuxtLink to="/studio/quizzes">Kuis</NuxtLink>
    </nav>

    <section>
      <h2>Artikel Saya</h2>
      <ul>
        <li v-for="a in articles ?? []" :key="a.id">
          <NuxtLink :to="`/studio/articles/${a.id}`">{{ a.title }}</NuxtLink>
          <span class="status-badge">{{ a.status }}</span>
        </li>
      </ul>
      <NuxtLink to="/studio/articles/new">+ Buat artikel baru</NuxtLink>
    </section>

    <section>
      <h2>Kelas Saya</h2>
      <ul>
        <li v-for="c in classes ?? []" :key="c.id">
          <NuxtLink :to="`/studio/classes/${c.id}`">{{ c.title }}</NuxtLink>
          <span class="status-badge">{{ c.status }}</span>
        </li>
      </ul>
      <NuxtLink to="/studio/classes/new">+ Buat kelas baru</NuxtLink>
    </section>
  </main>
</template>
```

- [ ] **Step 3: Implement the article editor**

Create `apps/web/app/pages/studio/articles/new.vue`:

```vue
<script setup lang="ts">
const form = reactive({
  title: '',
  body: '',
  topicId: '',
});
const submitting = ref(false);

async function save() {
  submitting.value = true;
  try {
    const created = await studioApi.createArticle(form);
    await navigateTo(`/studio/articles/${created.id}`);
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Artikel Baru — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Artikel Baru</h1>
    <form @submit.prevent="save">
      <label>Judul <input v-model="form.title" required /></label>
      <label>Topik (topic id) <input v-model="form.topicId" required /></label>
      <label>Isi (markdown)
        <textarea v-model="form.body" rows="20" required></textarea>
      </label>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Menyimpan…' : 'Simpan sebagai draf' }}</button>
    </form>
  </main>
</template>
```

Create `apps/web/app/pages/studio/articles/[id].vue` (load article + show status, with a "Submit for Review" button when status is DRAFT).

- [ ] **Step 4: Implement the class editor**

Create `apps/web/app/pages/studio/classes/new.vue`:

```vue
<script setup lang="ts">
const form = reactive({
  title: '',
  description: '',
  topicId: '',
  sessions: [] as Array<{ title: string; scheduledAt: string }>,
});
const submitting = ref(false);

async function save() {
  submitting.value = true;
  try {
    const created = await studioApi.createClass(form);
    await navigateTo(`/studio/classes/${created.id}`);
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Kelas Baru — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Kelas Baru</h1>
    <form @submit.prevent="save">
      <label>Judul <input v-model="form.title" required /></label>
      <label>Topik (topic id) <input v-model="form.topicId" required /></label>
      <label>Deskripsi <textarea v-model="form.description" /></label>
      <fieldset>
        <legend>Sesi</legend>
        <div v-for="(s, i) in form.sessions" :key="i">
          <input v-model="s.title" placeholder="Judul sesi" />
          <input v-model="s.scheduledAt" type="datetime-local" />
        </div>
        <button type="button" @click="form.sessions.push({ title: '', scheduledAt: '' })">Tambah sesi</button>
      </fieldset>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Menyimpan…' : 'Simpan sebagai draf' }}</button>
    </form>
  </main>
</template>
```

- [ ] **Step 5: Implement the article + class list pages**

`apps/web/app/pages/studio/articles/index.vue` and `apps/web/app/pages/studio/classes/index.vue` are thin wrappers around `studioApi.listArticles` / `studioApi.listClasses`. They re-use the dashboard list pattern.

- [ ] **Step 6: Implement `/studio/simulations` and `/studio/quizzes` placeholder pages

`apps/web/app/pages/studio/simulations/index.vue` and `apps/web/app/pages/studio/quizzes/index.vue` are deferred to V2 per spec §5.5 risk mitigation. Phase 4 ships a placeholder:

```vue
<script setup lang="ts">
useHead({ title: 'Simulasi — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Simulasi</h1>
    <p>Pembuat simulasi akan tersedia di V2.</p>
  </main>
</template>
```

- [ ] **Step 7: Verify SSR**

Run: `docker compose up -d --build web api`
Then: `curl -fsS -H "Cookie: <auth>" http://localhost/studio | grep -E "Studio|Artikel Saya"`
Expected: both phrases in the first response.

- [ ] **Step 8: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-4-studio-{viewport}-{scheme}.png`.

---

## Task 6: Build moderation queue UI for Reviewers

**Files:**
- Create: `apps/web/app/pages/admin/moderation/index.vue`
- Modify: `apps/web/app/lib/api.ts` (add moderation helpers)

A `REVIEWER` (or `ADMIN`) can see a queue of `PENDING_REVIEW` articles + classes and approve or reject each. Approval is deterministic; the LLM is not involved.

- [ ] **Step 1: Add the API helpers**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const moderationApi = {
  listPending: (token?: string) => request<{ articles: Article[]; classes: ClassProduct[] }>(`${API}/v1/admin/moderation/pending`, { token }),
  approve: (kind: 'article' | 'class', id: string, token?: string) =>
    request<{ status: string }>(`${API}/v1/admin/moderation/${kind === 'article' ? 'articles' : 'classes'}/${id}/approve`, { method: 'POST', token }),
  reject: (kind: 'article' | 'class', id: string, feedback: string, token?: string) =>
    request<{ status: string }>(`${API}/v1/admin/moderation/${kind === 'article' ? 'articles' : 'classes'}/${id}/reject`, { method: 'POST', body: { feedback }, token }),
};
```

The endpoints `/v1/admin/moderation/*` are added in Task 7.

- [ ] **Step 2: Implement the moderation queue page**

Create `apps/web/app/pages/admin/moderation/index.vue`:

```vue
<script setup lang="ts">
const { data } = await useFetch('/api/v1/admin/moderation/pending', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const acting = ref<string | null>(null);

async function approve(kind: 'article' | 'class', id: string) {
  acting.value = `${kind}:${id}`;
  try {
    await moderationApi.approve(kind, id);
    await refreshNuxtData();
  } finally {
    acting.value = null;
  }
}

async function reject(kind: 'article' | 'class', id: string) {
  const feedback = window.prompt('Alasan penolakan:') ?? '';
  if (!feedback) return;
  acting.value = `${kind}:${id}`;
  try {
    await moderationApi.reject(kind, id, feedback);
    await refreshNuxtData();
  } finally {
    acting.value = null;
  }
}

useHead({ title: 'Antrian Moderasi — Admin ReduCera' });
</script>

<template>
  <main>
    <h1>Antrian Moderasi</h1>

    <section>
      <h2>Artikel</h2>
      <ul>
        <li v-for="a in data?.articles ?? []" :key="a.id">
          <NuxtLink :to="`/studio/articles/${a.id}`">{{ a.title }}</NuxtLink>
          <button :disabled="acting === `article:${a.id}`" @click="approve('article', a.id)">Setujui</button>
          <button :disabled="acting === `article:${a.id}`" @click="reject('article', a.id)">Tolak</button>
        </li>
      </ul>
    </section>

    <section>
      <h2>Kelas</h2>
      <ul>
        <li v-for="c in data?.classes ?? []" :key="c.id">
          <NuxtLink :to="`/studio/classes/${c.id}`">{{ c.title }}</NuxtLink>
          <button :disabled="acting === `class:${c.id}`" @click="approve('class', c.id)">Setujui</button>
          <button :disabled="acting === `class:${c.id}`" @click="reject('class', c.id)">Tolak</button>
        </li>
      </ul>
    </section>
  </main>
</template>
```

- [ ] **Step 3: Guard the route server-side**

The page must be reachable only by `ADMIN` or `REVIEWER`. Implement `apps/web/app/middleware/admin-only.ts`:

```typescript
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useCurrentUser();
  if (!user || !['ADMIN', 'REVIEWER'].includes(user.role)) {
    return navigateTo('/');
  }
});
```

Register the middleware in `apps/web/app/pages/admin/moderation/index.vue`:

```vue
<script setup lang="ts">
definePageMeta({ middleware: ['admin-only'] });
// ... rest of the script
</script>
```

(If a `defineNuxtRouteMiddleware` already exists for admin routes, reuse that one.)

- [ ] **Step 4: Verify SSR**

Run: `curl -fsS -H "Cookie: <auth>" http://localhost/admin/moderation | grep -E "Antrian Moderasi|Artikel"`
Expected: at least the H1 is in the first response.

- [ ] **Step 5: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-4-moderation-{viewport}-{scheme}.png`.

---

## Task 7: Add the moderation endpoints (`/v1/admin/moderation/*`)

**Files:**
- Create: `services/api/src/v1/admin/moderation/moderation.controller.ts`
- Create: `services/api/src/v1/admin/moderation/moderation.service.ts`
- Create: `services/api/src/v1/admin/moderation/moderation.module.ts`
- Create: `services/api/src/v1/admin/moderation/__tests__/moderation.controller.spec.ts`

- [ ] **Step 1: Write the failing controller test**

Create `services/api/src/v1/admin/moderation/__tests__/moderation.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ModerationController } from '../moderation.controller';

describe('ModerationController (Phase 4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ModerationController],
      providers: [
        { provide: 'ModerationService', useValue: {
          listPending: jest.fn().mockResolvedValue({ articles: [{ id: 'a1' }], classes: [] }),
          approve: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }),
          reject: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
        } },
      ],
    })
      .overrideGuard('JwtAuthGuard').useValue({ canActivate: () => true })
      .overrideGuard('AdminReviewerGuard').useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('GET /pending returns queued items', async () => {
    const res = await request(app.getHttpServer()).get('/v1/admin/moderation/pending');
    expect(res.status).toBe(200);
    expect(res.body.articles[0].id).toBe('a1');
  });

  it('POST /articles/:id/approve moves status to PUBLISHED', async () => {
    const res = await request(app.getHttpServer()).post('/v1/admin/moderation/articles/a1/approve');
    expect(res.body.status).toBe('PUBLISHED');
  });

  it('POST /classes/:id/reject moves status to REJECTED', async () => {
    const res = await request(app.getHttpServer()).post('/v1/admin/moderation/classes/c1/reject').send({ feedback: '...' });
    expect(res.body.status).toBe('REJECTED');
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/admin/moderation/__tests__/moderation.controller.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/admin/moderation/moderation.service.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending() {
    const articles = await this.prisma.article.findMany({
      where: { status: 'PENDING_REVIEW' as any },
      include: { author: { select: { id: true, email: true } } },
    });
    const classes = await this.prisma.classProduct.findMany({
      where: { status: 'PENDING_REVIEW' as any },
      include: { author: { select: { id: true, email: true } } },
    });
    return { articles, classes };
  }

  async approve(kind: 'article' | 'class', id: string, reviewerId: string) {
    if (kind === 'article') {
      return this.prisma.article.update({
        where: { id },
        data: { status: 'PUBLISHED' as any, publishedAt: new Date(), reviewerId } as any,
      });
    }
    return this.prisma.classProduct.update({
      where: { id },
      data: { status: 'PUBLISHED' as any, publishedAt: new Date(), reviewerId } as any,
    });
  }

  async reject(kind: 'article' | 'class', id: string, reviewerId: string, feedback: string) {
    if (!feedback) throw new BadRequestException('feedback_required');
    if (kind === 'article') {
      return this.prisma.article.update({
        where: { id },
        data: { status: 'REJECTED' as any, reviewerId, rejectionFeedback: feedback } as any,
      });
    }
    return this.prisma.classProduct.update({
      where: { id },
      data: { status: 'REJECTED' as any, reviewerId, rejectionFeedback: feedback } as any,
    });
  }
}
```

- [ ] **Step 4: Implement the controller**

Create `services/api/src/v1/admin/moderation/moderation.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { AdminReviewerGuard } from '@/v1/common/guards/admin-reviewer.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { ModerationService } from './moderation.service';

@Controller('v1/admin/moderation')
@UseGuards(JwtAuthGuard, AdminReviewerGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('pending')
  pending() {
    return this.moderation.listPending();
  }

  @Post('articles/:id/approve')
  approveArticle(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.moderation.approve('article', id, user.id);
  }

  @Post('classes/:id/approve')
  approveClass(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.moderation.approve('class', id, user.id);
  }

  @Post('articles/:id/reject')
  rejectArticle(@Param('id') id: string, @Body() body: { feedback: string }, @CurrentUser() user: { id: string }) {
    return this.moderation.reject('article', id, user.id, body.feedback);
  }

  @Post('classes/:id/reject')
  rejectClass(@Param('id') id: string, @Body() body: { feedback: string }, @CurrentUser() user: { id: string }) {
    return this.moderation.reject('class', id, user.id, body.feedback);
  }
}
```

- [ ] **Step 5: Implement `AdminReviewerGuard`**

Create `services/api/src/v1/common/guards/admin-reviewer.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req?.user?.role;
    if (role !== 'ADMIN' && role !== 'REVIEWER') {
      throw new ForbiddenException('admin_or_reviewer_only');
    }
    return true;
  }
}
```

- [ ] **Step 6: Implement the module + register**

Create `services/api/src/v1/admin/moderation/moderation.module.ts`. Import in `v1.module.ts`.

- [ ] **Step 7: Run the test**

Run: `cd services/api && pnpm jest src/v1/admin/moderation/__tests__/moderation.controller.spec.ts --silent`
Expected: PASS, 3 tests.

---

## Task 8: Add `/creators/[id]` profile page

**Files:**
- Create: `apps/web/app/pages/creators/[id]/index.vue`
- Modify: `apps/web/app/lib/api.ts` (add creator profile helper)

A creator profile shows their bio, expertise, badges, and published articles + classes. SSR-rendered.

- [ ] **Step 1: Add the API helper**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const creatorProfileApi = {
  get: (id: string, token?: string) => request<{
    id: string; fullName: string; bio: string | null; portfolioUrl: string | null;
    articles: Article[]; classes: ClassProduct[]; badges: UserAchievement[];
  }>(`${API}/v1/creators/${id}`, { token }),
};
```

The `/v1/creators/:id` endpoint is added in Task 9.

- [ ] **Step 2: Implement the profile page**

Create `apps/web/app/pages/creators/[id]/index.vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const creatorId = computed(() => String(route.params.id));
const { data: creator } = await useFetch(() => `/api/v1/creators/${creatorId.value}`, {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

useHead({ title: () => creator.value ? `${creator.value.fullName} — ReduCera` : 'Kreator' });
</script>

<template>
  <main v-if="creator">
    <h1>{{ creator.fullName }}</h1>
    <p v-if="creator.bio">{{ creator.bio }}</p>
    <p v-if="creator.portfolioUrl"><a :href="creator.portfolioUrl">Portofolio</a></p>

    <section>
      <h2>Artikel</h2>
      <ul>
        <li v-for="a in creator.articles" :key="a.id">
          <NuxtLink :to="`/marketplace/articles/${a.id}`">{{ a.title }}</NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <h2>Kelas</h2>
      <ul>
        <li v-for="c in creator.classes" :key="c.id">
          <NuxtLink :to="`/marketplace/classes/${c.id}`">{{ c.title }}</NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <h2>Badge</h2>
      <BadgeGrid :items="creator.badges" />
    </section>
  </main>
</template>
```

- [ ] **Step 3: Verify SSR**

Run: `curl -fsS http://localhost/creators/<id> | grep -E "<creator's name>"`
Expected: H1 in the first response.

- [ ] **Step 4: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-4-creator-profile-{viewport}-{scheme}.png`.

---

## Task 9: Add `/v1/creators/:id` endpoint

**Files:**
- Create: `services/api/src/v1/teacher/creator-profile/creator-profile.controller.ts`
- Create: `services/api/src/v1/teacher/creator-profile/creator-profile.service.ts`
- Create: `services/api/src/v1/teacher/creator-profile/creator-profile.module.ts`
- Create: `services/api/src/v1/teacher/creator-profile/__tests__/creator-profile.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/teacher/creator-profile/__tests__/creator-profile.service.spec.ts`:

```typescript
import { CreatorProfileService } from '../creator-profile.service';

describe('CreatorProfileService.build', () => {
  let service: CreatorProfileService;

  beforeEach(() => {
    const prisma = {
      teacherApplication: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 'u1', fullName: 'Test', bio: '...', portfolioUrl: 'https://example.com',
        }),
      },
      article: { findMany: jest.fn().mockResolvedValue([]) },
      classProduct: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CreatorProfileService(prisma as any);
  });

  it('returns the user name, bio, articles, classes, badges', async () => {
    const out = await service.build('u1');
    expect(out).toMatchObject({ id: 'u1', fullName: 'Test' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/teacher/creator-profile/__tests__/creator-profile.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/teacher/creator-profile/creator-profile.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class CreatorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string) {
    const ta = await this.prisma.teacherApplication.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' },
    });
    if (!ta) return null;

    const articles = await this.prisma.article.findMany({
      where: { authorId: userId, status: 'PUBLISHED' as any },
      orderBy: { publishedAt: 'desc' },
    });
    const classes = await this.prisma.classProduct.findMany({
      where: { authorId: userId, status: 'PUBLISHED' as any },
      orderBy: { publishedAt: 'desc' },
    });
    const badges = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });

    return {
      id: userId,
      fullName: ta.fullName,
      bio: ta.bio,
      portfolioUrl: ta.portfolioUrl,
      articles,
      classes,
      badges,
    };
  }
}
```

- [ ] **Step 4: Implement the controller + module**

Create the controller:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CreatorProfileService } from './creator-profile.service';

@Controller('v1/creators')
@UseGuards(JwtAuthGuard)
export class CreatorProfileController {
  constructor(private readonly profile: CreatorProfileService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.profile.build(id);
  }
}
```

Create the module. Register in `v1.module.ts`.

- [ ] **Step 5: Run the test**

Run: `cd services/api && pnpm jest src/v1/teacher/creator-profile/__tests__/creator-profile.service.spec.ts --silent`
Expected: PASS.

---

## Task 10: Phase 4 acceptance gates

**Files:**
- Modify: `docs/progress-tracker.md` (final Phase 4 block)

- [ ] **Step 1: Run the full backend test suite**

Run:
```
cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q
```
Expected: both exit 0; cumulative test count ≥ 180 (per spec T1 budget).

- [ ] **Step 2: Verify the 4 Phase 4 acceptance gates from §5.5**

Gates:

1. `/become-creator` blocks submission unless mastery ≥ 0.85 — `curl -fsS -H "Authorization: Bearer <token-with-low-mastery>" -X POST -d '{...}' http://localhost/api/v1/teacher/applications` returns 400 `mastery_threshold_not_met`.
2. Studio `/articles/new` saves drafts — `curl -fsS -H "Authorization: Bearer <teacher-token>" -X POST -d '{...}' http://localhost/api/v1/articles` returns 201.
3. `POST /moderation/queue/:id/approve` requires `REVIEWER` or `ADMIN` role — `curl -i -H "Authorization: Bearer <student-token>" http://localhost/api/v1/admin/moderation/pending` returns 403.
4. Published article appears in marketplace within 60 seconds — full-stack integration test.

- [ ] **Step 3: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Three viewports × two color schemes × `reducedMotion: reduce` once for each of:
- `/become-creator`
- `/studio`, `/studio/articles/new`, `/studio/classes/new`
- `/admin/moderation`
- `/creators/<id>`

- [ ] **Step 4: Append the Phase 4 verification table to `docs/progress-tracker.md`**

```
## Phase 4 Verification (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| Eligibility 400 when mastery < 0.85 | PASS / FAIL | curl output |
| Studio articles/new saves draft | PASS / FAIL | curl output |
| Moderation queue 403 for non-reviewer | PASS / FAIL | curl -i output |
| Published article reaches marketplace | PASS / FAIL | integration test |
| Playwright matrix green | PASS / FAIL | screenshot list |
| Cumulative test count >= 180 | PASS / FAIL | test output |
```

- [ ] **Step 5: Owner review checkpoint**

Per AGENTS.md, executor does not commit. Pause for owner:
1. `git status` and review diff.
2. `pnpm build` for both services; `docker compose -f docker-compose.prod.yml config -q` valid.
3. Stage and commit at their discretion.
4. Mark Phase 4 `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 4 (deferred to later phases)

- Wallet, Transaction, RevenueShare, Withdrawal, HoldWindow: **Phase 5**
- VirtualCompany simulator UI: **Phase 6**
- AgentRouter, DecisionTrace, the AI celebration side of creator approval: **Phase 7**
- EventLog, MasterySnapshot, EngagementMetric, CreatorOutcomeMetric: **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**
- Rich WYSIWYG, video upload, interactive simulation authoring: **V2 (per spec §5.5 risk mitigation)**