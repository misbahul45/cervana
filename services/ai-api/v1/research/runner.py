from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from v1.research.experiment import (
    ArmObservation,
    ConfidenceInterval,
    Experiment,
    ExperimentArm,
    ExperimentMetric,
    ExperimentRun,
    PopulationSpec,
    bootstrap_confidence_interval,
)


class InsufficientSessions(RuntimeError):
    pass


class InsufficientEvidence(RuntimeError):
    pass


@dataclass
class RepeatabilityEvidence:
    metric: ExperimentMetric
    arm: ExperimentArm
    runs: int
    bootstrap_means: List[float]

    @property
    def mean(self) -> float:
        if not self.bootstrap_means:
            return 0.0
        return sum(self.bootstrap_means) / len(self.bootstrap_means)

    @property
    def variance(self) -> float:
        if len(self.bootstrap_means) < 2:
            return 0.0
        mean = self.mean
        return sum((x - mean) ** 2 for x in self.bootstrap_means) / (
            len(self.bootstrap_means) - 1
        )

    def is_stable(self, *, tolerance: float = 0.20) -> bool:
        if self.mean == 0:
            return True
        relative_var = abs(self.variance**0.5 / self.mean)
        return relative_var <= tolerance

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric": self.metric.value,
            "arm": self.arm.value,
            "runs": self.runs,
            "mean": self.mean,
            "variance": self.variance,
            "stable": self.is_stable(),
        }


class ExperimentRunner:
    def __init__(self, *, bootstrap_seed: int = 20261005) -> None:
        self.bootstrap_seed = bootstrap_seed

    def new_run(self, experiment: Experiment) -> ExperimentRun:
        return ExperimentRun(
            experiment_id=experiment.experiment_id,
            started_at=datetime.now(timezone.utc),
        )

    def record(
        self,
        run: ExperimentRun,
        arm: ExperimentArm,
        metric: ExperimentMetric,
        value: float,
    ) -> None:
        observations = run.observations
        if arm not in observations:
            observations[arm] = defaultdict(lambda: ArmObservation(arm=arm, metric=metric))
        bucket = observations[arm].get(metric)
        if bucket is None:
            bucket = ArmObservation(arm=arm, metric=metric)
            observations[arm][metric] = bucket
        bucket.samples.append(value)

    def _all_samples(self, run: ExperimentRun) -> List[float]:
        out: List[float] = []
        for arm_buckets in run.observations.values():
            for obs in arm_buckets.values():
                out.extend(obs.samples)
        return out

    def _per_arm_samples(
        self, run: ExperimentRun, arm: ExperimentArm, metric: ExperimentMetric
    ) -> List[float]:
        bucket = run.observations.get(arm, {}).get(metric)
        if bucket is None:
            return []
        return list(bucket.samples)

    def _requires_repeatability(
        self,
        run: ExperimentRun,
        experiment: Experiment,
    ) -> List[RepeatabilityEvidence]:
        evidences: List[RepeatabilityEvidence] = []
        for metric in experiment.metrics:
            for arm in (experiment.treatment, experiment.control):
                samples = self._per_arm_samples(run, arm, metric)
                if len(samples) < experiment.population.min_sessions_per_arm:
                    continue
                boot_means: List[float] = []
                for _ in range(3):
                    ci = bootstrap_confidence_interval(
                        samples,
                        confidence=1 - experiment.population.significance_level,
                        seed=self.bootstrap_seed + hash((arm, metric)) % 1000,
                    )
                    if ci is not None:
                        boot_means.append(ci.mean)
                evidences.append(
                    RepeatabilityEvidence(
                        metric=metric,
                        arm=arm,
                        runs=len(boot_means),
                        bootstrap_means=boot_means,
                    )
                )
        return evidences

    def _compute_winner(
        self,
        run: ExperimentRun,
        experiment: Experiment,
    ) -> Dict[ExperimentMetric, ExperimentArm]:
        winners: Dict[ExperimentMetric, ExperimentArm] = {}
        for metric in experiment.metrics:
            ci_treatment = bootstrap_confidence_interval(
                self._per_arm_samples(run, experiment.treatment, metric),
                confidence=1 - experiment.population.significance_level,
                seed=self.bootstrap_seed,
            )
            if ci_treatment is None:
                continue
            ci_control = bootstrap_confidence_interval(
                self._per_arm_samples(run, experiment.control, metric),
                confidence=1 - experiment.population.significance_level,
                seed=self.bootstrap_seed + 1,
            )
            if ci_control is None:
                continue
            lift = ci_treatment.mean - ci_control.mean
            if abs(lift) < 0.01:
                continue
            winners[metric] = (
                experiment.treatment if lift > 0 else experiment.control
            )
        return winners

    def finalize(
        self,
        run: ExperimentRun,
        experiment: Experiment,
    ) -> ExperimentRun:
        if not run.observations:
            raise InsufficientSessions("no observations recorded")

        total_samples = sum(
            obs.count
            for arm_buckets in run.observations.values()
            for obs in arm_buckets.values()
        )
        if total_samples < experiment.population.min_total_sessions:
            raise InsufficientSessions(
                f"total_sessions={total_samples} below "
                f"min_total_sessions={experiment.population.min_total_sessions}"
            )

        for arm in (experiment.treatment, experiment.control):
            arm_samples = sum(
                obs.count
                for metric, obs in run.observations.get(arm, {}).items()
                if metric in experiment.metrics
            )
            if arm_samples < experiment.population.min_sessions_per_arm:
                raise InsufficientSessions(
                    f"arm={arm.value} sessions={arm_samples} below "
                    f"min_sessions_per_arm={experiment.population.min_sessions_per_arm}"
                )

        intervals: List[ConfidenceInterval] = []
        for metric in experiment.metrics:
            for arm in (experiment.treatment, experiment.control):
                samples = self._per_arm_samples(run, arm, metric)
                ci = bootstrap_confidence_interval(
                    samples,
                    confidence=1 - experiment.population.significance_level,
                    seed=self.bootstrap_seed + hash((arm, metric)) % 1000,
                )
                if ci is not None:
                    ci.metric = metric
                    ci.arm = arm
                    intervals.append(ci)
        run.confidence_intervals = intervals

        run.winner_per_metric = self._compute_winner(run, experiment)
        for metric, arm in run.winner_per_metric.items():
            relevant = [
                e for e in run.confidence_intervals
                if e.metric is metric and e.arm is arm
            ]
            if not relevant or not any(ci.excludes_zero for ci in relevant):
                del run.winner_per_metric[metric]

        evidences = self._requires_repeatability(run, experiment)
        for evidence in evidences:
            if not evidence.is_stable():
                raise InsufficientEvidence(
                    f"metric={evidence.metric.value} arm={evidence.arm.value} "
                    f"is not stable across {evidence.runs} bootstrap runs "
                    f"(variance={evidence.variance:.4f})"
                )

        run.completed_at = datetime.now(timezone.utc)
        return run


__all__ = [
    "InsufficientSessions",
    "InsufficientEvidence",
    "RepeatabilityEvidence",
    "ExperimentRunner",
]