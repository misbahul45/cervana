# Standards Matrix

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Mapping of Cervana's target architecture and current implementation against external standards. Every claim uses `aligned / mapped / partially aligned / implementation gap / evidence available / evidence missing` — never `ISO compliant` or `certified`.

---

## 1. Conventions

Per the master prompt §2:

- **Never** use `ISO compliant`, `certified`, `fully circular`, `AI governance compliant` without independent third-party audit.
- **Allowed** statuses:
  - `aligned` — design intent matches the standard.
  - `mapped` — at least one control addresses the standard's requirement.
  - `partially aligned` — some controls exist, others are gaps.
  - `implementation gap` — control missing or broken.
  - `evidence available` — code evidence exists in the repo.
  - `evidence missing` — no code evidence today.

---

## 2. Circular-economy standards

### ISO 59004 — Circular economy — Guiding principles

| Principle | Cervana control | Evidence | Status |
|---|---|---|---|
| Value retention (keep resources in use) | `Resource` lifecycle + `isEmbedded` flag; lesson / step / quiz reuse | [`schema.prisma:640-660`](../../cervana-api/prisma/schema.prisma) | mapped |
| Value retention (knowledge) | Lesson / Step / Quiz reuse across Users | Prisma relations | mapped |
| Resource loops (biological + technical) | Not applicable — Cervana is a digital learning platform. Document this explicitly. | – | N/A |
| Stakeholder collaboration | Tutor / Creator / Learner roles | [`schema.prisma:731-768`](../../cervana-api/prisma/schema.prisma) | aligned |
| Transparency | `DailyStats`, `LeaderboardScore` tables | – | partially aligned |
| System thinking | Three-loop architecture (Fast / Medium / Slow) | [`target-state.md`](../02-architecture/target-state.md) | aligned |
| Circularity KPIs | Defined in [`circular-economy-model.md`](../02-architecture/circular-economy-model.md) | – | implementation gap |

### ISO 59010 — Circular economy — Business models

| Principle | Cervana control | Evidence | Status |
|---|---|---|---|
| Circular business models | Marketplace (Course + AI Agent) | [`ai-agent-marketplace.md`](../02-architecture/ai-agent-marketplace.md) | mapped |
| Reuse / repair / remanufacture / recycle | Content reuse (lesson → article → quiz → sandbox) | [`circular-economy-model.md`](../02-architecture/circular-economy-model.md) §3 | aligned |
| Sharing platforms | Article + free class funnel | – | mapped |

### ISO 59020 — Circular economy — Measuring and assessing

| Principle | Cervana control | Evidence | Status |
|---|---|---|---|
| Material flow measurement | Not applicable for digital platform | – | N/A |
| Circularity indicators | `CircularityKPI` model | [`circular-economy-model.md`](../02-architecture/circular-economy-model.md) §5 | implementation gap |
| Avoid vanity metrics | Excludes page views / click counts | Same | aligned |

### Important interpretation (master prompt §3)

Cervana is a **digital learning platform**. Its circularity is primarily:

- Knowledge circularity (lessons, articles, agents reused across learners and creators).
- Creator economic circularity (earnings → wallet → reinvestment → content).
- AI-credit circularity (earn in app → spend in app).

It is **not** a physical-material circular economy. Environmental-impact claims are excluded by definition.

---

## 3. Educational standards

### ISO 21001:2025 — Educational organizations — Management systems

| Principle | Cervana control | Evidence | Status |
|---|---|---|---|
| Learning objectives explicit | `Step.lessonId` + `Step.title/description` (must be filled by Tutor) | [`schema.prisma:240-261`](../../cervana-api/prisma/schema.prisma) | partially aligned |
| Prerequisites | `Step.prerequisiteSteps` (planned per [`data-model.md`](../02-architecture/data-model.md) §4) | – | implementation gap |
| Assessment linked to objectives | `Quiz` + `Question` + `Answer` + grading | [`quiz-attempts.service.ts`](../../cervana-api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts) | partially aligned (no evaluator yet) |
| Feedback to learner | `QuizAttempt.score` + `Answer.pointsEarned` | – | implementation gap |
| Continual improvement | Nightly eval + prompt versioning | [`dspy-integration.md`](../03-plans/dspy-integration.md) | planned |

---

## 4. AI governance standards

### ISO/IEC 42001 — AI management systems

| Control area | Cervana control | Evidence | Status |
|---|---|---|---|
| AI inventory | This docs tree (every AI capability documented) | – | aligned |
| Risk classification per AI use case | Each BF/DF/SF doc declares AI vs deterministic | – | aligned |
| Data sources documented | `data-model.md` + per-flow docs | – | aligned |
| Human oversight | `TeacherOverride`, human approval of `OptimizationRun` | [`data-model.md`](../02-architecture/data-model.md) §2.6 | mapped |
| Incident handling | Not yet defined | – | implementation gap |
| Rollback | Auto-rollback on canary regression documented | [`self-improving-llm.md`](../03-plans/self-improving-llm.md) §Layer 5 | planned |
| Documented limitations per AI capability | AI feature card required | [`target-state.md`](../02-architecture/target-state.md) §4 | planned |

### ISO/IEC 23894 — AI risk management

| Control area | Cervana control | Evidence | Status |
|---|---|---|---|
| Risk identification | Master prompt §57 attack taxonomy → [`security-audit.md`](../01-audit/security-audit.md) | – | mapped |
| Risk evaluation | Severity table in each audit doc | – | aligned |
| Risk treatment | Mitigations documented per finding | – | aligned |
| Monitoring | OTel + Episode log + DecisionTrace (planned) | [`target-state.md`](../02-architecture/target-state.md) §4.9 | planned |

---

## 5. Accessibility standards

### WCAG 2.2

| Principle | Cervana control | Evidence | Status |
|---|---|---|---|
| Perceivable | TBD — frontend audit needed | – | implementation gap |
| Operable (keyboard) | TBD | – | implementation gap |
| Understandable | TBD | – | implementation gap |
| Robust | TBD | – | implementation gap |
| Non-text content (alt text, etc.) | TBD | – | implementation gap |
| Motion | Reduced motion preference (planned) | – | planned |

---

## 6. Security standards

### OWASP ASVS 5.0

| Verification requirement | Cervana control | Evidence | Status |
|---|---|---|---|
| V1 — Architecture | Service boundaries documented | [`service-boundaries.md`](../03-plans/service-boundaries.md) | aligned |
| V2 — Authentication | JWT + Google OAuth + Arcjet | [`auth.controller.ts`](../../cervana-api/src/v1/auth/auth.controller.ts) | mapped |
| V3 — Session management | Cookie config + refresh tokens | Same | mapped |
| V4 — Access control | RolesGuard exists; ownership checks absent | [`api-inventory.md`](../01-audit/api-inventory.md) | implementation gap |
| V5 — Input validation | Zod DTOs + `ZodPipe` | – | aligned |
| V6 — Cryptography | Cookies `secure`, `sameSite: 'none'` | [`auth.controller.ts:415-428`](../../cervana-api/src/v1/auth/auth.controller.ts) | mapped |
| V7 — Error handling and logging | `errorHandler`, `AppExceptionsFilter` | – | mapped |
| V8 — Data protection | Encryption-at-rest is Postgres default; in-transit via Nginx | – | mapped |
| V9 — Communications | HTTPS via Nginx | [`nginx.conf`](../../nginx/nginx.conf) | mapped |
| V10 — Malicious code | Per-service image; Arcjet WAF for auth | – | partially aligned |
| V11 — Business logic | Per-endpoint audit; ownership + business-logic docs | – | implementation gap |
| V12 — Files and uploads | Resource upload + extraction; no allow-list yet | – | implementation gap |
| V13 — API and web service | Bearer auth + JSON contracts; rate limit (Arcjet) partial | – | partially aligned |
| V14 — Configuration | Single root `.env`; secrets in env vars only | – | aligned |

### OWASP Top 10 for LLM Applications (2025)

| Risk | Cervana control | Evidence | Status |
|---|---|---|---|
| LLM01 — Prompt Injection | Instruction-only defense today | [`security-audit.md`](../01-audit/security-audit.md) §2 | implementation gap |
| LLM02 — Insecure Output Handling | Output filtered for `citatetions: []`; no other filters today | – | implementation gap |
| LLM03 — Training Data Poisoning | No external training data ingestion; RAG only | – | N/A (low risk) |
| LLM04 — Model DoS | Rate limiting on auth routes only | – | implementation gap |
| LLM05 — Supply Chain | `langchain-openai` plan to add | – | planned |
| LLM06 — Sensitive Info Disclosure | No output filter to redact IDs / emails | – | implementation gap |
| LLM07 — Insecure Plugin Design | Tools not formally registered yet | – | implementation gap |
| LLM08 — Excessive Agency | Tool permissions exist (R/W/EXTERNAL ACTION) | [`tool-audit.md`](../01-audit/tool-audit.md) | mapped |
| LLM09 — Overreliance | LLM-as-judge with rubric + frozen benchmark | – | planned |
| LLM10 — Model Theft | Model runs in ai-api; no public exposure | – | aligned |

---

## 7. Learning interoperability standards

### xAPI 2.0

| Concept | Cervana control | Evidence | Status |
|---|---|---|---|
| Actor | `User.id` | – | mapped |
| Verb | `LearningEvent.eventType` enum | [`data-model.md`](../02-architecture/data-model.md) §2.3 | mapped |
| Object | `Lesson`, `Step`, `Quiz` ids | – | mapped |
| Context | `course.json`, `lesson.json` payloads | – | aligned |
| Result | `QuizAttempt.score`, mastery | – | mapped |
| Storage | Internal Postgres `Episode` table | – | mapped |
| LRS conformance | Not yet implemented | – | implementation gap |

### LTI 1.3 / LTI Advantage

| Control | Cervana control | Evidence | Status |
|---|---|---|---|
| Tool launch | Not implemented | – | implementation gap |
| Deep linking | Not implemented | – | implementation gap |
| Grade passback | Not implemented | – | implementation gap |
| Role provisioning | Internal RBAC exists; LTI roles not mapped | – | implementation gap |

Decision: defer LTI integration until a concrete external LMS integration is required.

---

## 8. Mapping summary

| Standard | Scope | Status |
|---|---|---|
| ISO 59004 | Circular economy principles | mapped |
| ISO 59010 | Circular business models | mapped |
| ISO 59020 | Circular measurement | implementation gap |
| ISO 21001:2025 | Education management | partially aligned |
| ISO/IEC 42001 | AI management | mapped |
| ISO/IEC 23894 | AI risk | aligned |
| WCAG 2.2 | Accessibility | implementation gap |
| OWASP ASVS 5.0 | Web security | partially aligned |
| OWASP Top 10 LLM 2025 | LLM security | mapped (5/10) |
| xAPI 2.0 | Learning events | mapped |
| LTI 1.3 | LMS integration | deferred (not required) |

---

## 9. Gaps the standards matrix exposes

| Gap | Severity | Action |
|---|---|---|
| WCAG 2.2 frontend audit not performed | HIGH | Add accessibility-audit task in Phase 12 |
| LLM01 — prompt injection control | HIGH | Phase 5 (input segmentation) |
| LLM02 / LLM06 — output filtering | MEDIUM | Phase 5 + Phase 6 |
| LLM04 — model DoS rate limit | MEDIUM | Phase 12 |
| LLM07 — plugin design formalization | MEDIUM | Phase 8 (DSPy `bind_tools`) |
| ISO 59020 — circularity measurement | MEDIUM | Phase 11 |
| ISO 21001 — continual improvement loop | LOW | Already partly in self-improving-llm.md |

---

## 10. How to use this matrix

For every new feature:

1. Locate the relevant standard row.
2. Determine whether the feature is `aligned / mapped / implementation gap`.
3. Add evidence or note the gap.
4. If the gap is HIGH or above, it becomes a CRITICAL or HIGH finding and enters the implementation backlog.

This matrix is updated whenever a control changes status.