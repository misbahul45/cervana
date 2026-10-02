"""Agent registry for ai-api.

Phase 2 registers the deterministic CurriculumAgent. Phase 7 (agents)
expands this registry with LangGraph-backed streaming agents.
"""

from .curriculum_agent import run_curriculum

__all__ = ["run_curriculum"]