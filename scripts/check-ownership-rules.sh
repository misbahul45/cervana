#!/usr/bin/env bash
set -euo pipefail

violations=0

scan() {
  local label="$1"; shift
  local hits
  if hits="$("$@" 2>/dev/null)"; then
    if [ -n "$hits" ]; then
      echo "VIOLATION [$label]:"
      echo "$hits"
      echo
      violations=$((violations+1))
    fi
  fi
}

scan "ai-api uses prisma client" sh -c "grep -rn --exclude-dir=.venv 'prisma\.' services/ai-api/ 2>/dev/null | grep -v __pycache__ || true"
scan "ai-api references DATABASE_URL" sh -c "grep -rn --exclude-dir=.venv 'DATABASE_URL' services/ai-api/ 2>/dev/null | grep -v __pycache__ || true"
scan "ai-api imports prisma" sh -c "grep -rn --exclude-dir=.venv 'import.*prisma' services/ai-api/ 2>/dev/null | grep -v __pycache__ || true"

scan "ai-api calls api without the signing client" sh -c "
  grep -rlE 'NEST_API' services/ai-api --include=*.py \
    --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=__tests__ --exclude-dir=tests --exclude-dir=agents 2>/dev/null \
    | grep -v -E '^services/ai-api/(conftest\\.py|config/(envs|user_auth|internal_client|service_auth)\\.py)\$' \
    | xargs -r grep -LE 'InternalApiClient|send_signed' || true
"

scan "compose gives a service variables that are not its own" python3 scripts/check-compose-env.py

scan "learner tables written outside the learner events service" sh -c "
  grep -rnE '(conceptMastery|learningEvent|learnerStream)\\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\\b' services/api/src --include=*.ts 2>/dev/null \\
    | grep -v -E '/__tests__/|\\.spec\\.ts:|^services/api/src/v1/learner-model/events/learner-events\\.service\\.ts:' || true
"

scan "reward ledger written outside the reward ledger service" sh -c "
  grep -rnE 'gamificationLedger\\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\\b' services/api/src --include=*.ts 2>/dev/null \\
    | grep -v -E '/__tests__/|\\.spec\\.ts:|^services/api/src/v1/gamify/rewards/reward-ledger\\.service\\.ts:' || true
"

scan "achievement unlocks written outside the achievement evaluator" sh -c "
  grep -rnE 'userAchievement\\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\\b' services/api/src --include=*.ts 2>/dev/null \\
    | grep -v -E '/__tests__/|\\.spec\\.ts:|^services/api/src/v1/gamify/achievements/achievement-evaluator\\.ts:' || true
"

scan "streak days written outside the streak engine" sh -c "
  grep -rnE 'streakHistory\\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\\b' services/api/src --include=*.ts 2>/dev/null \\
    | grep -v -E '/__tests__/|\\.spec\\.ts:|^services/api/src/v1/gamify/streaks/(streak-engine\\.service|streaks\\.repo)\\.ts:' || true
"

scan "legacy topic mastery tables used by code" sh -c "
  grep -rnE '\\.(topicMasteryRecord|skillNode)\\.' services/api/src --include=*.ts 2>/dev/null \\
    | grep -v -E '/__tests__/|\\.spec\\.ts:' || true
"

scan "api references qdrant client directly" sh -c "grep -rn 'qdrant_client\\|QdrantClient' services/api/src 2>/dev/null | grep -v node_modules || true"

scan "api imports ChatOpenAI/ChatGoogleGenerativeAI/ChatAnthropic" sh -c "grep -rnE 'ChatOpenAI|ChatGoogleGenerativeAI|ChatAnthropic' services/api/src 2>/dev/null | grep -v node_modules || true"

scan "api imports langchain_google/GeminiEmbedding" sh -c "grep -rnE 'langchain_google|GeminiEmbedding' services/api/src 2>/dev/null | grep -v node_modules || true"

scan "api uses OPENAI_BASE_URL/OPENAI_API_KEY/ANTHROPIC_API_KEY in source" sh -c "grep -rnE 'OPENAI_API_KEY|OPENAI_BASE_URL|ANTHROPIC_API_KEY' services/api/src 2>/dev/null | grep -v node_modules || true"

scan "Gemini or google.generativeai tokens in tracked source" sh -c "
  grep -rniE 'GEMINI_API_KEY|google\\.generativeai|generativelanguage' \
    --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=.git \
    --exclude-dir=dist --exclude-dir=.output --exclude-dir=.playwright-mcp \
    --exclude='*.lock' --exclude='pnpm-lock.yaml' \
    services/api/ apps/ .env.example docker-compose.yml docker-compose.prod.yml 2>/dev/null \
    | grep -v -E '(comment|//|test|//|metadata\\.google\\.internal|metadata\\.google)' || true
"

if [ "$violations" -gt 0 ]; then
  echo "Ownership rule violations: $violations"
  exit 1
fi
echo "Ownership rules: PASS"