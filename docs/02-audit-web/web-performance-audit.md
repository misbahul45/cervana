# Web Performance Audit

**Scope:** `apps/web/nuxt.config.ts` + `apps/web/app/pages/**` + `apps/web/app/components/**`. Date: 2026-10-05.

## 1. Headline

- Bundle includes Tailwind v4, Nuxt UI, TanStack Vue Query, Pinia, lucide, motion-v, mammoth, pdf-parse, papaparse, markdown-it, zod, @vueuse/motion.
- SSR is enabled globally (`ssr: true`).
- SEO meta tags present (OG, Twitter, theme-color).
- Performance budgets (`J_pub`, `J_lrn`, `J_stu`, `T_lcp_*`, `C_max`, `T_inp`) are defined as parameters per master prompt §82 but no concrete measurements exist yet.

## 2. Known Risks

- `mammoth`, `pdf-parse`, `papaparse`, `markdown-it`, `pdf-parse` may bloat the SSR bundle if imported eagerly.
- `lucide` + `@iconify-json/*` + `motion-v` are heavy — need per-route dynamic imports.
- Client-only surfaces (chatbot, editor, sandbox, tutor) must use `<ClientOnly>` to keep them out of SSR HTML.
- Random `Math.random()` during SSR is forbidden (master prompt §66). Need code-level grep.

## 3. Required Follow-Ups (PHASE 9)

Per master prompt §83 + §118:
- Measure LCP, CLS, TTFB, JS transfer size, interaction latency for changed routes at 375x812 + 1280x800.
- Record baseline vs changed.
- Detect regressions and fix.