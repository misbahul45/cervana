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

scan "ai-api uses prisma client" sh -c "grep -rn 'prisma\.' services/ai-api/ 2>/dev/null | grep -v __pycache__ || true"
scan "ai-api references DATABASE_URL" sh -c "grep -rn 'DATABASE_URL' services/ai-api/ 2>/dev/null | grep -v __pycache__ || true"
scan "ai-api imports prisma" sh -c "grep -rn 'import.*prisma' services/ai-api/ 2>/dev/null | grep -v __pycache__ || true"

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