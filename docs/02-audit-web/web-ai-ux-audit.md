# Web AI UX Audit

**Scope:** tutor page(s) + chatbot component(s) + AI-credit interaction surfaces. Date: 2026-10-05.

## 1. Headline

- The master prompt requires an explicit `/tutor/[sessionId]` route. Current routes either render tutor inline inside lesson pages (`app/pages/my-learning/lessons/[id]/*`) or inside the chatbot components.
- The credit surface is named `/wallet/*` rather than the master prompt's `/credits`.
- AI label, credit-cost confirmation, citation visibility, and grounded-answer state are required by master prompt §15, §31–§35, §52, §127–§129.

## 2. Required Behaviors (master prompt)

- AI generated content clearly labeled.
- Credit cost shown before confirmation.
- Citations visible and associated with source.
- Grounding failure: "Materi tidak ditemukan" (not a fake answer).
- Tutor response presentation: explanation + examples + steps + citations + next action — no raw JSON.
- Reduced-motion respected for streaming.
- No client-calculated wallet or credit values (master prompt §75).

## 3. Required Follow-Ups (PHASE 3 + PHASE 6)

1. Verify every tutor surface routes through `/tutor/[sessionId]` per master prompt §19.
2. Verify `CreditCostConfirm` is rendered before every paid tutor action.
3. Verify `CitationList` is rendered alongside every AI answer.
4. Verify `INSUFFICIENT_CREDITS` / `LLM_UNAVAILABLE` / `GROUNDING_EMPTY` / `TIMEOUT` states exist.
5. Verify `Dijawab oleh AI.` label is rendered (master prompt §35).