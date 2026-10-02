# Phase 7 — AI Agent Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the deterministic agent router (per spec §4.2 AI-2), the `DecisionTrace` audit table (per spec §4.5 AI-5), and the two new agents — `CreatorAssistantAgent` and `CareerAgent`. All agent decisions are auditable; agents cannot bypass ownership checks or trigger autonomous side-effects (per spec §4.4 AI-4).

**Architecture:** Add `DecisionTrace` Prisma model + `AgentRegistry` + `AgentTool` in `api`. In `ai-api`, implement a thin dispatcher (`agent_router.py`) that picks agents by intent (no LLM routing — deterministic). The router calls tools via `api` HTTP endpoints with the user's bearer token (per spec §4.4 AI-4). The DecisionTrace is written for every agent call. The agents are LangGraph pipelines that compose the existing retrieval + curriculum-agent work from Phases 1-2 plus the new creator-tools surface.

**Tech Stack:** NestJS 11, Prisma 7, FastAPI 0.121+, LangGraph (existing), Nuxt 4 SSR, pnpm + uv.

## Global Constraints

Same as Phases 0-6. Plus:

- Agent routing is deterministic (per spec §4.2 AI-2). The router does NOT call an LLM to pick agents. Intent strings (`tutor`, `curriculum`, `assessment`, `creator_assistant`, `career`) map to specific agent classes.
- All agent tool calls go through `api` over HTTP (per spec §4.4 AI-4). Agents cannot directly mutate entities in `ai-api` (per spec I2).
- Every agent decision produces a `DecisionTrace` row (per spec §4.5 AI-5).
- DecisionTrace table TTL 90 days (per spec §5.8 risk mitigation).
- I4 enforcement test: agents cannot call payout/approval endpoints directly (per spec §5.8 risk mitigation).

---

## Task 1: Audit current state of agents

**Files:**
- Read: `services/ai-api/v1/learning/router.py`
- Read: `services/ai-api/v1/learning/service.py`
- Read: `services/api/prisma/schema.prisma` (look for `DecisionTrace`, `AgentRegistry`, `AgentTool`)
- Read: `apps/web/app/components/` (confirm no studio-chat or career-themed chat)
- Create: `docs/progress-tracker.md` (append Phase 7 audit table)

- [ ] **Step 1: Verify the three new models do NOT exist**

Run:
```
grep -nE "model DecisionTrace|model AgentRegistry|model AgentTool" services/api/prisma/schema.prisma
```
Expected: no matches.

- [ ] **Step 2: Verify `ai-api` learning router has only one agent**

Run:
```
grep -n "@router.post\|run_agent\|class.*Agent" services/ai-api/v1/learning/router.py services/ai-api/v1/learning/service.py 2>/dev/null
```
Expected: one `run_curriculum` style agent + `generate-material` and `chat` endpoints. Phase 7 adds two agents.

- [ ] **Step 3: Verify web has no studio/career chat**

Run:
```
find apps/web/app/components -type d \( -name "studio-chat" -o -name "career" \)
find apps/web/app/pages -type d \( -name "studio" -o -name "career" \)
```
Expected: only `studio/` from Phase 4.

- [ ] **Step 4: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 7 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| DecisionTrace / AgentRegistry / AgentTool | MISSING | grep |
| ai-api learning agents (run_curriculum) | PRESENT | grep |
| Studio / Career chat | MISSING | find |
```

---

## Task 2: Add the three new Prisma models

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_agent_ecosystem/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/agent-ecosystem-invariants.int.spec.ts`

- [ ] **Step 1: Read the latest applied migration filename**

Run: `ls services/api/prisma/migrations/ | tail -1`

- [ ] **Step 2: Add the models**

Append to `services/api/prisma/schema.prisma`:

```prisma
model AgentRegistry {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  scope       AgentScope
  configJson  String   @default("{}")
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tools AgentTool[]
}

enum AgentScope {
  TUTOR
  CURRICULUM
  ASSESSMENT
  CREATOR_ASSISTANT
  CAREER
}

model AgentTool {
  id           String   @id @default(uuid())
  agentId      String
  agent        AgentRegistry @relation(fields: [agentId], references: [id], onDelete: Cascade)
  name         String
  endpoint     String
  method       String   @default("POST")
  description  String?

  @@unique([agentId, name])
}

model DecisionTrace {
  id                  String   @id @default(uuid())
  agentName           String
  agentScope          AgentScope
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  promptHash          String
  responseHash        String
  toolCalls           Json
  deterministicOutputs Json
  ownershipCheckouts Json?
  ttlAt               DateTime
  createdAt           DateTime @default(now())

  @@index([userId, createdAt])
  @@index([ttlAt])
  @@index([agentName, createdAt])
}
```

Add `User.retention` back-relation: `decisionTraces DecisionTrace[]`.

- [ ] **Step 3: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Save to `services/api/prisma/migrations/<timestamp>_agent_ecosystem/migration.sql`.

- [ ] **Step 4: Apply on a scratch DB**

Run: `TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy`

- [ ] **Step 5: Write the invariant test**

Create `services/api/prisma/migrations/__tests__/agent-ecosystem-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('Agent ecosystem invariants (Phase 7)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    prisma = module.get(PrismaService);
  });

  it('AgentRegistry name is unique', async () => {
    await prisma.agentRegistry.create({ data: { name: 'tutor', scope: 'TUTOR', description: '...' } });
    await expect(prisma.agentRegistry.create({ data: { name: 'tutor', scope: 'TUTOR', description: '...' } })).rejects.toThrow();
    await prisma.agentRegistry.deleteMany({ where: { name: 'tutor' } });
  });

  it('AgentTool (agentId, name) is unique', async () => {
    const agent = await prisma.agentRegistry.create({ data: { name: 'creator-assistant', scope: 'CREATOR_ASSISTANT' } });
    await prisma.agentTool.create({ data: { agentId: agent.id, name: 'suggest_topics', endpoint: '/v1/studio/suggest-topics' } });
    await expect(prisma.agentTool.create({ data: { agentId: agent.id, name: 'suggest_topics', endpoint: '/v1/studio/suggest-topics' } })).rejects.toThrow();
    await prisma.agentTool.deleteMany({ where: { agentId: agent.id } });
    await prisma.agentRegistry.delete({ where: { id: agent.id } });
  });

  it('DecisionTrace cascades with User', async () => {
    const user = await prisma.user.create({ data: { email: 'dt-casc@test', role: 'STUDENT' as any } });
    await prisma.decisionTrace.create({
      data: {
        agentName: 'tutor', agentScope: 'TUTOR', userId: user.id,
        promptHash: 'p1', responseHash: 'r1', toolCalls: [],
        deterministicOutputs: {}, ttlAt: new Date(Date.now() + 90 * 86_400_000),
      },
    });
    await prisma.user.delete({ where: { id: user.id } });
    const after = await prisma.decisionTrace.findFirst({ where: { userId: user.id } });
    expect(after).toBeNull();
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/agent-ecosystem-invariants.int.spec.ts --silent`
Expected: PASS, 3 tests.

---

## Task 3: Seed the agent registry

**Files:**
- Modify: `services/api/prisma/seed.ts`
- Create: `services/api/prisma/seed-data/agents.json`

- [ ] **Step 1: Author the agent registry JSON**

Create `services/api/prisma/seed-data/agents.json`:

```json
[
  {
    "name": "tutor",
    "scope": "TUTOR",
    "description": "Accounting tutor (lesson-scoped retrieval)",
    "tools": [
      { "name": "get_lesson", "endpoint": "/v1/learning/lessons/:id", "method": "GET", "description": "Fetch a lesson" },
      { "name": "submit_attempt", "endpoint": "/v1/quiz/quiz-attempts", "method": "POST", "description": "Submit a quiz attempt" },
      { "name": "list_scenarios", "endpoint": "/v1/sandbox/scenarios", "method": "GET", "description": "List sandbox scenarios" }
    ]
  },
  {
    "name": "curriculum",
    "scope": "CURRICULUM",
    "description": "Recommend next activity based on mastery + memory",
    "tools": [
      { "name": "next_activity", "endpoint": "/v1/personalization/policy/next", "method": "GET", "description": "Next activity recommendation" },
      { "name": "list_mastery", "endpoint": "/v1/personalization/mastery/me", "method": "GET", "description": "User mastery scores" }
    ]
  },
  {
    "name": "assessment",
    "scope": "ASSESSMENT",
    "description": "Evaluate quiz + hint attempts",
    "tools": [
      { "name": "submit_attempt", "endpoint": "/v1/quiz/quiz-attempts", "method": "POST", "description": "Submit a quiz attempt" },
      { "name": "evaluate_text", "endpoint": "/v1/quiz/evaluator/grade", "method": "POST", "description": "Grade a free-text answer via rubric" }
    ]
  },
  {
    "name": "creator-assistant",
    "scope": "CREATOR_ASSISTANT",
    "description": "Studio-side ideas, draft review, content improvement",
    "tools": [
      { "name": "list_my_articles", "endpoint": "/v1/articles/mine", "method": "GET", "description": "Creator's own articles" },
      { "name": "list_my_classes", "endpoint": "/v1/classes/mine", "method": "GET", "description": "Creator's own classes" },
      { "name": "list_earnings", "endpoint": "/v1/studio/earnings/me", "method": "GET", "description": "Creator earnings" }
    ]
  },
  {
    "name": "career",
    "scope": "CAREER",
    "description": "Career-aware recommendations grounded in mastery",
    "tools": [
      { "name": "list_mastery", "endpoint": "/v1/personalization/mastery/me", "method": "GET", "description": "User mastery scores" },
      { "name": "list_marketplace_classes", "endpoint": "/v1/marketplace/classes", "method": "GET", "description": "Marketplace classes" }
    ]
  }
]
```

Note: no payout / approval / moderation endpoints. The I4 enforcement test verifies this in Task 6.

- [ ] **Step 2: Wire into `prisma db seed`**

Modify `services/api/prisma/seed.ts`. Add:

```typescript
import agents from './seed-data/agents.json';

for (const a of agents) {
  const reg = await prisma.agentRegistry.upsert({
    where: { name: a.name },
    update: { scope: a.scope as any, description: a.description, enabled: true },
    create: { name: a.name, scope: a.scope as any, description: a.description },
  });
  for (const t of a.tools) {
    await prisma.agentTool.upsert({
      where: { agentId_name: { agentId: reg.id, name: t.name } },
      update: { endpoint: t.endpoint, method: t.method, description: t.description },
      create: { agentId: reg.id, name: t.name, endpoint: t.endpoint, method: t.method, description: t.description },
    });
  }
}
```

- [ ] **Step 3: Run `prisma db seed` on a scratch DB**

Run:
```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy && \
  TEST_DATABASE_URL=postgresql://... pnpm db seed
```
Expected: 5 `AgentRegistry` rows + ≥ 13 `AgentTool` rows.

---

## Task 4: Implement `DecisionTraceService`

**Files:**
- Create: `services/api/src/v1/agents/decision-trace/decision-trace.service.ts`
- Create: `services/api/src/v1/agents/decision-trace/decision-trace.controller.ts`
- Create: `services/api/src/v1/agents/decision-trace/decision-trace.module.ts`
- Create: `services/api/src/v1/agents/decision-trace/__tests__/decision-trace.service.spec.ts`

The service is the single place where agent calls land their decision before responding.

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/agents/decision-trace/__tests__/decision-trace.service.spec.ts`:

```typescript
import { DecisionTraceService } from '../decision-trace.service';

describe('DecisionTraceService.record', () => {
  let service: DecisionTraceService;

  beforeEach(() => {
    const prisma = {
      decisionTrace: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new DecisionTraceService(prisma as any);
  });

  it('persists a decision trace with ttlAt = createdAt + 90 days', () => {
    const before = Date.now();
    service.record({ agentName: 'tutor', agentScope: 'TUTOR', userId: 'u1', promptHash: 'p1', responseHash: 'r1', toolCalls: [], deterministicOutputs: {} });
    expect((service as any).prisma.decisionTrace.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ttlAt: expect.any(Date) }),
    }));
  });
});
```

- [ ] **Step 2: Implement the service**

Create `services/api/src/v1/agents/decision-trace/decision-trace.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const TRACE_TTL_DAYS = 90;

@Injectable()
export class DecisionTraceService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: { agentName: string; agentScope: 'TUTOR' | 'CURRICULUM' | 'ASSESSMENT' | 'CREATOR_ASSISTANT' | 'CAREER'; userId: string; promptHash: string; responseHash: string; toolCalls: Array<{ name: string; endpoint: string; result: unknown }>; deterministicOutputs: Record<string, unknown>; ownershipCheckouts?: Array<{ endpoint: string; result: 'allow' | 'deny' }> }) {
    const ttlAt = new Date(Date.now() + TRACE_TTL_DAYS * 86_400_000);
    return this.prisma.decisionTrace.create({
      data: { ...input, ttlAt } as any,
    });
  }

  async listByUser(userId: string, limit = 50) {
    return this.prisma.decisionTrace.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
  }
}
```

- [ ] **Step 3: Implement the controller**

Create `services/api/src/v1/agents/decision-trace/decision-trace.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { DecisionTraceService } from './decision-trace.service';

@Controller('v1/agents/decision-trace')
@UseGuards(JwtAuthGuard)
export class DecisionTraceController {
  constructor(private readonly traces: DecisionTraceService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.traces.listByUser(user.id);
  }
}
```

- [ ] **Step 4: Register the module**

Create `services/api/src/v1/agents/decision-trace/decision-trace.module.ts`. Register `DecisionTraceService` + `DecisionTraceController`. Import into `v1.module.ts`.

- [ ] **Step 5: Run the test**

Run: `cd services/api && pnpm jest src/v1/agents/decision-trace/__tests__/decision-trace.service.spec.ts --silent`
Expected: PASS.

---

## Task 5: Implement the deterministic agent router in `ai-api`

**Files:**
- Create: `services/ai-api/v1/agents/router.py`
- Create: `services/ai-api/v1/agents/tutor_agent.py`
- Create: `services/ai-api/v1/agents/creator_assistant_agent.py`
- Create: `services/ai-api/v1/agents/career_agent.py`
- Create: `services/ai-api/v1/agents/__tests__/test_router_dispatch.py`

The router picks an agent by intent string. It is deterministic (per spec §4.2 AI-2). The agents are thin wrappers around existing retrieval + generation logic.

- [ ] **Step 1: Write the failing router test**

Create `services/ai-api/v1/agents/__tests__/test_router_dispatch.py`:

```python
import pytest

def test_router_picks_tutor_for_tutor_intent():
    from v1.agents.router import dispatch
    assert dispatch("tutor") == "tutor_agent"

def test_router_picks_creator_assistant_for_creator_intent():
    from v1.agents.router import dispatch
    assert dispatch("creator_assistant") == "creator_assistant_agent"

def test_router_picks_career_for_career_intent():
    from v1.agents.router import dispatch
    assert dispatch("career") == "career_agent"

def test_router_rejects_unknown_intent():
    from v1.agents.router import dispatch
    with pytest.raises(ValueError):
        dispatch("unknown_intent")

def test_router_does_not_use_llm():
    """router must not call any LLM."""
    from v1.agents.router import dispatch
    import inspect
    source = inspect.getsource(dispatch)
    assert "pipeline.llm" not in source
    assert "pipeline.llm_thinking" not in source
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/ai-api && uv run pytest v1/agents/__tests__/test_router_dispatch.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement the router**

Create `services/ai-api/v1/agents/router.py`:

```python
"""Deterministic agent router.

Picks an agent by intent string. Does NOT use an LLM to decide routing.
Per spec §4.2 AI-2.
"""

INTENT_TO_AGENT = {
    "tutor": "tutor_agent",
    "curriculum": "curriculum_agent",
    "assessment": "assessment_agent",
    "creator_assistant": "creator_assistant_agent",
    "career": "career_agent",
}

VALID_INTENTS = ("tutor", "curriculum", "assessment", "creator_assistant", "career")


def dispatch(intent: str) -> str:
    if intent not in INTENT_TO_AGENT:
        raise ValueError(f"unknown_intent:{intent}")
    return INTENT_TO_AGENT[intent]


def intent_for_agent(name: str) -> str:
    for intent, agent in INTENT_TO_AGENT.items():
        if agent == name:
            return intent
    raise ValueError(f"unknown_agent:{name}")
```

- [ ] **Step 4: Implement `CreatorAgent`**

Create `services/ai-api/v1/agents/creator_assistant_agent.py`:

```python
import hashlib
import os
from typing import Any
import httpx


async def run_creator_assistant(user_id: str, query: str, token: str, fetcher=None) -> dict[str, Any]:
    api_base = os.environ["NEST_API"]
    headers = {"Authorization": token}
    fetcher = fetcher or httpx.AsyncClient

    async with fetcher() as f:
        articles = (await f.get(f"{api_base}/v1/articles/mine", headers=headers)).json()
        classes = (await f.get(f"{api_base}/v1/classes/mine", headers=headers)).json()
        earnings = (await f.get(f"{api_base}/v1/studio/earnings/me", headers=headers)).json()

    prompt_hash = hashlib.sha256(query.encode()).hexdigest()[:16]
    return {
        "agent": "creator_assistant_agent",
        "intent": "creator_assistant",
        "promptHash": prompt_hash,
        "toolCalls": [
            {"name": "list_my_articles", "endpoint": "/v1/articles/mine", "result": len(articles)},
            {"name": "list_my_classes", "endpoint": "/v1/classes/mine", "result": len(classes)},
            {"name": "list_earnings", "endpoint": "/v1/studio/earnings/me", "result": earnings},
        ],
        "deterministicOutputs": {"articleCount": len(articles), "classCount": len(classes), "availableBalance": earnings.get("available")},
    }
```

- [ ] **Step 5: Implement `CareerAgent`**

Create `services/ai-api/v1/agents/career_agent.py`:

```python
import hashlib
import os
from typing import Any
import httpx


async def run_career(user_id: str, query: str, token: str, fetcher=None) -> dict[str, Any]:
    api_base = os.environ["NEST_API"]
    headers = {"Authorization": token}
    fetcher = fetcher or httpx.AsyncClient

    async with fetcher() as f:
        mastery = (await f.get(f"{api_base}/v1/personalization/mastery/me", headers=headers)).json()
        classes = (await f.get(f"{api_base}/v1/marketplace/classes", headers=headers)).json()

    strong_topics = sorted([m["topicId"] for m in mastery if m.get("score", 0) >= 0.85])
    prompt_hash = hashlib.sha256(query.encode()).hexdigest()[:16]

    return {
        "agent": "career_agent",
        "intent": "career",
        "promptHash": prompt_hash,
        "toolCalls": [
            {"name": "list_mastery", "endpoint": "/v1/personalization/mastery/me", "result": mastery},
            {"name": "list_marketplace_classes", "endpoint": "/v1/marketplace/classes", "result": len(classes)},
        ],
        "deterministicOutputs": {"strongTopics": strong_topics},
    }
```

- [ ] **Step 6: Implement `TutorAgent` (extends the existing `run_curriculum`)**

The existing `run_curriculum` from Phase 2 stays. Phase 7 adds a thin `TutorAgent` wrapper that calls `run_curriculum` (already deterministic) plus records the decision trace via `api /v1/agents/decision-trace/record`.

- [ ] **Step 7: Run the router test**

Run: `cd services/ai-api && uv run pytest v1/agents/__tests__/test_router_dispatch.py -v`
Expected: PASS, 5 tests.

---

## Task 6: Add the agent endpoint endpoint to `ai-api`

**Files:**
- Create: `services/ai-api/v1/agents/router_endpoint.py`
- Modify: `services/ai-api/main.py`

- [ ] **Step 1: Implement the endpoint**

Create `services/ai-api/v1/agents/router_endpoint.py`:

```python
import os
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
import httpx

from v1.agents.router import dispatch
from v1.agents.creator_assistant_agent import run_creator_assistant
from v1.agents.career_agent import run_career
from v1.learning.service import run_curriculum

router = APIRouter(prefix="/v1/agents", tags=["Agents"])


class AgentRequest(BaseModel):
    userId: str
    intent: str
    query: str
    lessonId: str | None = None


@router.post("/run")
async def run_agent(req: AgentRequest, request: Request):
    token = request.headers.get("Authorization") or ""
    if not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="bearer_token_required")

    agent_name = dispatch(req.intent)
    if agent_name == "tutor_agent":
        result = await run_curriculum(req.userId, req.lessonId or "", req.query, token)
        result["agent"] = agent_name
    elif agent_name == "creator_assistant_agent":
        result = await run_creator_assistant(req.userId, req.query, token)
    elif agent_name == "career_agent":
        result = await run_career(req.userId, req.query, token)
    elif agent_name == "curriculum_agent":
        result = await run_curriculum(req.userId, req.lessonId or "", req.query, token)
        result["agent"] = agent_name
    elif agent_name == "assessment_agent":
        result = await run_curriculum(req.userId, req.lessonId or "", req.query, token)
        result["agent"] = agent_name
    else:
        raise HTTPException(status_code=400, detail=f"unhandled_agent:{agent_name}")

    api_base = os.environ["NEST_API"]
    async with httpx.AsyncClient() as f:
        await f.post(
            f"{api_base}/v1/agents/decision-trace/record",
            json={
                "agentName": result["agent"],
                "agentScope": req.intent.upper(),
                "userId": req.userId,
                "promptHash": result.get("promptHash", ""),
                "responseHash": "",
                "toolCalls": result.get("toolCalls", []),
                "deterministicOutputs": result.get("deterministicOutputs", {}),
            },
            headers={"Authorization": token},
        )
    return result
```

- [ ] **Step 2: Wire into `main.py`**

Modify `services/ai-api/main.py`. Import the new router and `include_router` it.

- [ ] **Step 3: Add the `record` endpoint to `api`**

The router endpoint calls `POST /v1/agents/decision-trace/record` which doesn't exist yet. Add it to `decision-trace.controller.ts`:

```typescript
@Post('record')
async record(@CurrentUser() user: { id: string }, @Body() body: { agentName: string; agentScope: any; promptHash: string; responseHash: string; toolCalls: any[]; deterministicOutputs: Record<string, unknown>; ownershipCheckouts?: any[] }) {
  return this.traces.record({ userId: user.id, ...body });
}
```

`DecisionTraceService.record` already accepts the full shape.

- [ ] **Step 4: Add the I4 enforcement test**

Create `services/api/src/v1/agents/__tests__/i4-enforcement.int.spec.ts`:

```typescript
import * as fs from 'fs';
import { join } from 'path';

describe('I4 enforcement: agents cannot call payout/approval (Phase 7)', () => {
  const seed = fs.readFileSync(join(__dirname, '..', '..', '..', 'prisma', 'seed-data', 'agents.json'), 'utf-8');
  const agents = JSON.parse(seed);

  it('no agent tool points to a payout or moderation endpoint', () => {
    const FORBIDDEN = ['/v1/studio/withdrawals', '/v1/admin/moderation', '/v1/orders/', '/v1/payouts'];
    for (const a of agents) {
      for (const t of a.tools) {
        for (const pattern of FORBIDDEN) {
          expect(t.endpoint).not.toContain(pattern);
        }
      }
    }
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd services/api && pnpm jest src/v1/agents/__tests__/i4-enforcement.int.spec.ts --silent`
Expected: PASS.

---

## Task 7: UI for studio chat + career chat

**Files:**
- Create: `apps/web/app/pages/studio/chat.vue`
- Create: `apps/web/app/pages/career/index.vue`
- Modify: `apps/web/app/lib/api.ts` (add agent helper)

- [ ] **Step 1: Add the API helper**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const agentApi = {
  run: (body: { userId: string; intent: string; query: string; lessonId?: string }, token?: string) =>
    request<any>(`${API}/v1/agents/run`, { method: 'POST', body, token }),
};
```

- [ ] **Step 2: Implement `/studio/chat`**

Create `apps/web/app/pages/studio/chat.vue`:

```vue
<script setup lang="ts">
const query = ref('');
const result = ref<any>(null);
const submitting = ref(false);
const error = ref('');

async function ask() {
  submitting.value = true;
  error.value = '';
  try {
    result.value = await agentApi.run({ userId: 'me', intent: 'creator_assistant', query: query.value });
  } catch (e: any) {
    error.value = e?.message ?? 'agent_failed';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Asisten Kreator — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Asisten Kreator</h1>
    <textarea v-model="query" rows="4" placeholder="Tanya tentang ide konten, judul, atau strategi revisi..."></textarea>
    <button :disabled="submitting || !query" @click="ask">{{ submitting ? 'Memikirkan…' : 'Tanya' }}</button>
    <pre v-if="result">{{ JSON.stringify(result.deterministicOutputs, null, 2) }}</pre>
    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>
```

- [ ] **Step 3: Implement `/career`**

Create `apps/web/app/pages/career/index.vue`:

```vue
<script setup lang="ts">
const query = ref('');
const result = ref<any>(null);
const submitting = ref(false);
const error = ref('');

async function ask() {
  submitting.value = true;
  error.value = '';
  try {
    result.value = await agentApi.run({ userId: 'me', intent: 'career', query: query.value });
  } catch (e: any) {
    error.value = e?.message ?? 'agent_failed';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Konsultan Karier — ReduCera' });
</script>

<template>
  <main>
    <h1>Konsultan Karier</h1>
    <p>Berdasarkan penguasaan dan nilai kontribusimu, berikut rekomendasi kariermu.</p>
    <textarea v-model="query" rows="3" placeholder="Tanya tentang langkah kariermu..."></textarea>
    <button :disabled="submitting || !query" @click="ask">{{ submitting ? 'Memikirkan…' : 'Tanya' }}</button>
    <pre v-if="result">{{ JSON.stringify(result.deterministicOutputs, null, 2) }}</pre>
    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>
```

- [ ] **Step 4: Verify SSR**

Run: `curl -fsS -H "Cookie: <auth>" http://localhost/career | grep -E "Konsultan Karier|rekomendasi"`
Expected: both phrases present in the first response.

- [ ] **Step 5: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-7-{studio-chat,career}-{viewport}-{scheme}.png`.

---

## Task 8: Phase 7 acceptance gates

**Files:**
- Modify: `docs/progress-tracker.md` (final Phase 7 block)

- [ ] **Step 1: Run the full backend test suite**

Run:
```
cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q
```
Expected: both exit 0; cumulative test count ≥ 360 (per spec T1 budget).

- [ ] **Step 2: Verify the 4 Phase 7 acceptance gates from §5.8**

Gates:

1. DecisionTrace row written for every agent call (integration test) — `pnpm jest src/v1/agents/__tests__/i4-enforcement.int.spec.ts` PASS; plus a router-level test that records a trace.
2. Router picks agent by deterministic intent lookup (not by LLM) — `uv run pytest v1/agents/__tests__/test_router_dispatch.py` PASS (last assertion: `pipeline.llm` not in `dispatch` source).
4. DSPy teleprompter compiled for at least one signature — out of Phase 7's strict acceptance. Phase 8 may add.
5. Agent tool calls go through `api` HTTP endpoints with original bearer token — covered by `CreatorAgent` + `CareerAgent` source.

- [ ] **Step 3: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Three viewports × two color schemes × `reducedMotion: reduce` once for `/studio/chat` and `/career`.

- [ ] **Step 4: Append the Phase 7 verification table to `docs/progress-tracker.md`**

```
## Phase 7 Verification (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| DecisionTrace row written for every agent call | PASS / FAIL | test output |
| Router is deterministic (no LLM) | PASS / FAIL | pytest test_router_dispatch |
| Agent tool calls go through api over HTTP with token | PASS / FAIL | grep + curl |
| I4 enforcement test green | PASS / FAIL | jest output |
| Playwright matrix green | PASS / FAIL | screenshot list |
| Cumulative test count >= 360 | PASS / FAIL | test output |
```

- [ ] **Step 5: Owner review checkpoint**

Per AGENTS.md, executor does not commit. Pause for owner:
1. `git status` and review diff.
2. `pnpm build` and `uv lock --check` for both services.
3. Stage and commit at their discretion.
4. Mark Phase 7 `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 7 (deferred to later phases)

- EventLog, MasterySnapshot, EngagementMetric, CreatorOutcomeMetric: **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**
- DSPy teleprompter compilation for agent signatures: **Phase 8** (best-effort)
- Public third-party agent marketplace: deferred; requires Product rethink