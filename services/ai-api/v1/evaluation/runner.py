from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from v1.evaluation.benchmark import BENCHMARK_SCENARIOS, BENCHMARK_VERSION, BenchmarkScenario
from v1.evaluation.dimensions import (
    DimensionName,
    EvaluationReport,
    ExpectationRubric,
)
from v1.evaluation.evaluator import (
    EVALUATOR_PROMPT_VERSION,
    DeterministicEvaluator,
    TutorOutput,
)


@dataclass
class BenchmarkRunSummary:
    benchmark_version: str
    evaluator_version: str
    n_scenarios: int
    n_accepted: int
    n_rejected: int
    acceptance_rate: float
    average_aggregate: float
    per_dimension_average: Dict[str, float] = field(default_factory=dict)
    per_category_average: Dict[str, float] = field(default_factory=dict)
    per_difficulty_average: Dict[str, float] = field(default_factory=dict)
    reports: List[EvaluationReport] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "benchmarkVersion": self.benchmark_version,
            "evaluatorVersion": self.evaluator_version,
            "nScenarios": self.n_scenarios,
            "nAccepted": self.n_accepted,
            "nRejected": self.n_rejected,
            "acceptanceRate": self.acceptance_rate,
            "averageAggregate": self.average_aggregate,
            "perDimensionAverage": dict(self.per_dimension_average),
            "perCategoryAverage": dict(self.per_category_average),
            "perDifficultyAverage": dict(self.per_difficulty_average),
        }


class BenchmarkRunner:
    def __init__(
        self,
        *,
        evaluator: Optional[DeterministicEvaluator] = None,
        benchmark_version: str = BENCHMARK_VERSION,
        evaluator_version: str = EVALUATOR_PROMPT_VERSION,
    ) -> None:
        self.evaluator = evaluator or DeterministicEvaluator(
            evaluator_version=evaluator_version,
        )
        self.benchmark_version = benchmark_version

    def scenarios(self) -> List[BenchmarkScenario]:
        return list(BENCHMARK_SCENARIOS)

    def run(
        self,
        *,
        output_factory=None,
    ) -> BenchmarkRunSummary:
        reports: List[EvaluationReport] = []
        for scenario in self.scenarios():
            if output_factory is None:
                output = self._default_output_for(scenario)
            else:
                output = output_factory(scenario)
            report = self.evaluator.evaluate(output, scenario.rubric)
            reports.append(report)

        n = len(reports)
        accepted = sum(1 for r in reports if r.accepted)
        aggregate_avg = (
            sum(r.aggregate for r in reports) / n if n > 0 else 0.0
        )

        per_dimension: Dict[str, List[float]] = {}
        for r in reports:
            for s in r.scores:
                per_dimension.setdefault(s.dimension.value, []).append(s.value)
        per_dim_avg = {
            k: (sum(vs) / len(vs) if vs else 0.0)
            for k, vs in per_dimension.items()
        }

        per_category: Dict[str, List[float]] = {}
        for r, s in zip(reports, self.scenarios()):
            per_category.setdefault(s.category, []).append(r.aggregate)
        per_cat_avg = {
            k: (sum(vs) / len(vs) if vs else 0.0)
            for k, vs in per_category.items()
        }

        per_difficulty: Dict[str, List[float]] = {}
        for r, s in zip(reports, self.scenarios()):
            per_difficulty.setdefault(s.difficulty, []).append(r.aggregate)
        per_diff_avg = {
            k: (sum(vs) / len(vs) if vs else 0.0)
            for k, vs in per_difficulty.items()
        }

        return BenchmarkRunSummary(
            benchmark_version=self.benchmark_version,
            evaluator_version=self.evaluator.evaluator_version,
            n_scenarios=n,
            n_accepted=accepted,
            n_rejected=n - accepted,
            acceptance_rate=accepted / n if n > 0 else 0.0,
            average_aggregate=aggregate_avg,
            per_dimension_average=per_dim_avg,
            per_category_average=per_cat_avg,
            per_difficulty_average=per_diff_avg,
            reports=reports,
        )

    @staticmethod
    def _default_output_for(scenario: BenchmarkScenario) -> TutorOutput:
        return TutorOutput(
            scenario_id=scenario.scenario_id,
            trace_id=f"trace-{scenario.scenario_id}",
            prompt_version="unknown-v0",
            response_text=(
                f"{scenario.user_query.split('?')[0]} involves debit and credit; "
                f"the double-entry principle requires Σ debits == Σ credits. "
                f"Use the chart of accounts and consult the prerequisite chain."
            ),
            rag_evidence=[{"source": "material", "score": 0.8, "snippet": "double entry"}],
            adaptive_strategy_dict={"strategy": "DIRECT_EXPLANATION", "difficulty": 0.5},
            domain_ontology_excerpt="double_entry, debit, credit",
            cited_concepts=scenario.rubric.expected_concepts,
            latency_ms=200,
            cost_usd=0.001,
            tokens_in=100,
            tokens_out=200,
        )


__all__ = [
    "BenchmarkRunSummary",
    "BenchmarkRunner",
]