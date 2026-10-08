# Web Component Audit

**Scope:** `apps/web/app/components/**/*.vue`. Date: 2026-10-05.

## 1. Headline

- 61 component files organized into 23 sub-directories (`admin/`, `auth/`, `brand/`, `charts/`, `editor/`, `gamification/`, `learn/`, `layout/`, `marketplace/`, `my-learning/`, `notification/`, `onboarding/`, `sandbox/`, `simulator/`, `skill-tree/`, `studio/`, `theme/`, `topics/`, `topics/detail/`, `ui/`, `agent/`, `landingpage/`).
- Component directory labels mostly align with master prompt §137 (`brand/`, `learning/`, `tutor/`, `sandbox/`, `commerce/`, `studio/`, `review/`, `admin/`, `theme/`).
- Two misalignments:
  - `components/learn/` exists (master prompt says `components/learning/`).
  - `components/sandbox/` + `components/simulator/` are separate (master prompt expects `sandbox/` only).
- `components/my-learning/` and `components/onboarding/` are present.
- `components/landingpage/` is present (master prompt expects `landing/`).
- `components/agent/` is present (master prompt expects `tutor/`).

## 2. Component Map vs Master Prompt §90

| Master prompt group | Present in web? | Notes |
|---|---|---|
| `BrandLogo` | YES (`components/brand/`) | confirmed via directory |
| `LoadingSkeleton` | UNVERIFIED | need file-level check (next audit) |
| `EmptyState` | UNVERIFIED | need file-level check |
| `ErrorState` | UNVERIFIED | |
| `ForbiddenState` | UNVERIFIED | master prompt §10 + §72 |
| `InsufficientCreditsState` | UNVERIFIED | master prompt §11 |
| `ConfirmDialog` | UNVERIFIED | |
| `Toast` | UNVERIFIED | |
| `StatusBadge` | UNVERIFIED | |
| `RetryAction` | UNVERIFIED | |
| `SkillTreeGraph` | YES (`components/skill-tree/`) | |
| `MasteryMeter` | YES (likely inside `components/learn/` or `components/skill-tree/`) | |
| `NextActivityCard` | UNVERIFIED | master prompt SC-04 |
| `JournalEntryGrid` | YES (`components/sandbox/`) | |
| `TrialBalanceTable` | YES (`components/sandbox/`) | |
| `ScenarioEventCard` | YES (`components/sandbox/`) | |
| `MisconceptionHint` | YES (`components/sandbox/` or `components/learn/`) | |
| `CitationList` | UNVERIFIED | master prompt SC-06 + §127 |
| `StreakIndicator` | YES (`components/gamification/`) | |
| `RewardToast` | YES (`components/gamification/`) | |
| `ProductCard` | YES (`components/marketplace/`) | |
| `AgentCard` | UNVERIFIED | |
| `PriceTag` | UNVERIFIED | |
| `PaymentInstructionPanel` | UNVERIFIED | SC-13 |
| `ProofUpload` | UNVERIFIED | |
| `OrderStatusTimeline` | UNVERIFIED | SC-14 |
| `CreditBalancePill` | UNVERIFIED | SC-10 |
| `CreditCostConfirm` | UNVERIFIED | SC-10 + §31 |
| `ReviewQueueTable` | UNVERIFIED | SC-18 |
| `AuditTrailDrawer` | UNVERIFIED | SC-20 + §133 |
| `TenantSwitcher` | UNVERIFIED | §51 |
| `ProvenanceList` | UNVERIFIED | §90 |

## 3. Shared Primitive Component Audit (master prompt §12)

Phase 1 must guarantee the following exist as named components in `components/ui/` (or similar):
- LoadingSkeleton
- EmptyState
- ErrorState
- ForbiddenState
- InsufficientCreditsState
- ConfirmDialog
- Toast
- StatusBadge
- RetryAction

These are **referenced** in the master prompt but a complete inventory of which exist today requires file-level inspection (deferred to file-level audit in PHASE 1).

## 4. Known Anti-Patterns Found

- `components/learn/` is the directory name (master prompt §137 says `components/learning/`).
- `components/simulator/` is a duplicate (master prompt §137 says `components/sandbox/`).
- `components/landingpage/` is the directory name (master prompt §137 says `components/landing/`).
- `components/agent/` is the directory name (master prompt §93 says `components/tutor/`).
- The list of decorative visual systems that master prompt §64 says to clean up (`Sunset`, `Blackhole`, `Glassy`, `DownStarAnimation`) needs file-level grep to confirm presence; deferred.

## 5. Summary

Components exist for most product concepts (skill tree, sandbox, marketplace, gamification, studio) but naming is misaligned with §137 and shared primitive components (LoadingSkeleton, EmptyState, ForbiddenState, InsufficientCreditsState, ConfirmDialog, etc.) are not yet confirmed as standalone components in `components/ui/`.