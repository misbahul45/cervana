# Web Accessibility Audit

**Scope:** global a11y primitives across `apps/web/app/components/**` + `apps/web/app/pages/**` + `apps/web/nuxt.config.ts`. Date: 2026-10-05.

## 1. Headline

- `nuxt.config.ts` sets `htmlAttrs: { lang: 'id' }` — Indonesian language attribute present on root.
- Theme color tokens declared in CSS (`theme-color` meta for light/dark).
- Reduced-motion and forced-colors handling is delegated to Tailwind/CSS but the audit cannot confirm component-level compliance without per-component file review.

## 2. Master Prompt §84 Acceptance Matrix (must be verified per screen)

| Check | Status |
|---|---|
| `lang` attribute on root | PRESENT (`id`) |
| One main landmark per page | DEFERRED — file-level audit |
| One h1 per page | DEFERRED |
| Heading hierarchy | DEFERRED |
| Focus visibility | DEFERRED |
| Focus order matches DOM order | DEFERRED |
| Keyboard reachable (Tab + visible focus ring) | DEFERRED |
| Body text contrast ≥ 4.5:1 | DEFERRED — needs Playwright/contrast measurement |
| aria labels / aria-describedby on forms | DEFERRED |
| Live regions (toast, validation errors) | DEFERRED |
| Reduced-motion override | DEFERRED |
| Forced-colors override | DEFERRED |
| Touch targets ≥ 44px (mobile) | DEFERRED |

## 3. Required Follow-Ups (deferred to PHASE 9 Polish)

For each primary route:
1. Verify single `<h1>` and proper heading hierarchy.
2. Verify keyboard tab order and focus visibility.
3. Verify contrast ratios via Playwright a11y tests.
4. Verify reduced-motion handling.
5. Verify touch-target sizes.

These are PHASE 9 acceptance gates per master prompt §84 + §107 + §116 + §119.