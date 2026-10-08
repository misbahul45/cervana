from __future__ import annotations

import pytest

from v1.research import (
    ALLOWED_OUTCOME_METRICS,
    Experiment,
    ExperimentArm,
    ExperimentMetric,
    ExperimentRunner,
    InsufficientEvidence,
    InsufficientSessions,
    PopulationSpec,
    PROHIBITED_OPTIMIZATION_TARGETS,
    RepeatabilityEvidence,
    bootstrap_confidence_interval,
)


def _population(min_sessions: int = 5) -> PopulationSpec:
    return PopulationSpec(
        min_sessions_per_arm=min_sessions,
        min_total_sessions=min_sessions * 2,
        power=0.8,
    )


def _experiment(metrics=None) -> Experiment:
    return Experiment(
        experiment_id="exp-1",
        hypothesis="D_full_stack beats A_static_tutor on LEARNING_GAIN.",
        population=_population(),
        treatment=ExperimentArm.D_FULL_STACK,
        control=ExperimentArm.A_STATIC_TUTOR,
        metrics=metrics or [ExperimentMetric.LEARNING_GAIN],
        duration_days=14,
    )


def test_experiment_arm_descriptions_present():
    assert "static tutor" in ExperimentArm.A_STATIC_TUTOR.description.lower()
    assert "learner model" in ExperimentArm.B_LEARNER_MODEL.description.lower()
    assert "memory" in ExperimentArm.C_LEARNER_MODEL_MEMORY.description.lower()
    assert "DSPy" in ExperimentArm.D_FULL_STACK.description


def test_population_spec_validates_constraints():
    with pytest.raises(ValueError):
        PopulationSpec(min_sessions_per_arm=0, min_total_sessions=10, power=0.8)
    with pytest.raises(ValueError):
        PopulationSpec(min_sessions_per_arm=5, min_total_sessions=5, power=0.8)
    with pytest.raises(ValueError):
        PopulationSpec(min_sessions_per_arm=5, min_total_sessions=10, power=1.5)


def test_experiment_rejects_same_arm_treatment_and_control():
    with pytest.raises(ValueError):
        Experiment(
            experiment_id="exp-1",
            hypothesis="x",
            population=_population(),
            treatment=ExperimentArm.A_STATIC_TUTOR,
            control=ExperimentArm.A_STATIC_TUTOR,
            metrics=[ExperimentMetric.LEARNING_GAIN],
            duration_days=7,
        )


def test_experiment_rejects_prohibited_optimization_targets():
    with pytest.raises(ValueError):
        Experiment(
            experiment_id="exp-1",
            hypothesis="x",
            population=_population(),
            treatment=ExperimentArm.B_LEARNER_MODEL,
            control=ExperimentArm.A_STATIC_TUTOR,
            metrics=["daily_opens"],
            duration_days=7,
        )


def test_experiment_rejects_empty_metrics():
    with pytest.raises(ValueError):
        Experiment(
            experiment_id="exp-1",
            hypothesis="x",
            population=_population(),
            treatment=ExperimentArm.B_LEARNER_MODEL,
            control=ExperimentArm.A_STATIC_TUTOR,
            metrics=[],
            duration_days=7,
        )


def test_experiment_rejects_empty_hypothesis():
    with pytest.raises(ValueError):
        Experiment(
            experiment_id="exp-1",
            hypothesis="   ",
            population=_population(),
            treatment=ExperimentArm.B_LEARNER_MODEL,
            control=ExperimentArm.A_STATIC_TUTOR,
            metrics=[ExperimentMetric.LEARNING_GAIN],
            duration_days=7,
        )


def test_allowed_outcome_metrics_cover_personalization_measurement_targets():
    for metric in (
        ExperimentMetric.LEARNING_GAIN,
        ExperimentMetric.MASTERY_PROGRESSION,
        ExperimentMetric.MISCONCEPTION_RESOLUTION,
        ExperimentMetric.RETENTION,
        ExperimentMetric.TASK_SUCCESS,
        ExperimentMetric.HINT_DEPENDENCY,
        ExperimentMetric.LEARNING_MILESTONE_COMPLETION,
        ExperimentMetric.VALIDATED_PRACTICE_FREQUENCY,
    ):
        assert metric in ALLOWED_OUTCOME_METRICS


def test_prohibited_optimization_targets_excludes_activity_volume():
    for prohibited in ("daily_opens", "chat_messages", "click_through", "page_views", "logins"):
        assert prohibited in PROHIBITED_OPTIMIZATION_TARGETS


def test_bootstrap_confidence_interval_excludes_zero_for_positive_samples():
    samples = [0.8, 0.82, 0.81, 0.79, 0.83, 0.8, 0.81, 0.82, 0.79, 0.8]
    ci = bootstrap_confidence_interval(samples, confidence=0.95, resamples=500)
    assert ci is not None
    assert ci.lower > 0
    assert ci.excludes_zero


def test_bootstrap_confidence_interval_includes_zero_when_samples_overlap_zero():
    samples = [0.01, -0.01, 0.02, -0.02, 0.0]
    ci = bootstrap_confidence_interval(samples, confidence=0.95, resamples=500)
    assert ci is not None
    assert ci.lower <= 0 <= ci.upper
    assert not ci.excludes_zero


def test_bootstrap_confidence_interval_returns_none_for_too_few_samples():
    assert bootstrap_confidence_interval([0.5]) is None


def test_bootstrap_confidence_interval_rejects_invalid_confidence():
    with pytest.raises(ValueError):
        bootstrap_confidence_interval([0.1, 0.2], confidence=1.5)


def test_experiment_runner_new_run_starts_with_started_at():
    runner = ExperimentRunner()
    run = runner.new_run(_experiment())
    assert run.started_at is not None
    assert run.completed_at is None


def test_experiment_runner_record_appends_samples():
    runner = ExperimentRunner()
    run = runner.new_run(_experiment(metrics=[ExperimentMetric.LEARNING_GAIN]))
    runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.LEARNING_GAIN, 0.5)
    runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.LEARNING_GAIN, 0.6)
    bucket = run.observations[ExperimentArm.A_STATIC_TUTOR][ExperimentMetric.LEARNING_GAIN]
    assert bucket.samples == [0.5, 0.6]


def test_experiment_runner_finalize_rejects_insufficient_sessions():
    runner = ExperimentRunner()
    run = runner.new_run(_experiment())
    for arm in (ExperimentArm.A_STATIC_TUTOR, ExperimentArm.D_FULL_STACK):
        runner.record(run, arm, ExperimentMetric.LEARNING_GAIN, 0.5)
    with pytest.raises(InsufficientSessions):
        runner.finalize(run, _experiment())


def test_experiment_runner_finalize_rejects_insufficient_per_arm():
    runner = ExperimentRunner()
    run = runner.new_run(_experiment())
    for _ in range(20):
        runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.LEARNING_GAIN, 0.5)
    for _ in range(2):
        runner.record(run, ExperimentArm.D_FULL_STACK, ExperimentMetric.LEARNING_GAIN, 0.5)
    with pytest.raises(InsufficientSessions):
        runner.finalize(run, _experiment())


def test_experiment_runner_declares_winner_when_treatment_beats_control():
    runner = ExperimentRunner()
    run = runner.new_run(_experiment(metrics=[ExperimentMetric.LEARNING_GAIN]))
    rng_arm = lambda b: 0.6 + b  # arm B
    rng_arm_b = lambda b: 0.3 + b
    for _ in range(10):
        runner.record(run, ExperimentArm.D_FULL_STACK, ExperimentMetric.LEARNING_GAIN, 0.9)
    for _ in range(10):
        runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.LEARNING_GAIN, 0.4)
    run = runner.finalize(run, _experiment(metrics=[ExperimentMetric.LEARNING_GAIN]))
    assert ExperimentMetric.LEARNING_GAIN in run.winner_per_metric
    assert run.winner_per_metric[ExperimentMetric.LEARNING_GAIN] is ExperimentArm.D_FULL_STACK


def test_experiment_runner_no_winner_when_no_meaningful_lift():
    runner = ExperimentRunner()
    run = runner.new_run(_experiment(metrics=[ExperimentMetric.LEARNING_GAIN]))
    for _ in range(10):
        runner.record(run, ExperimentArm.D_FULL_STACK, ExperimentMetric.LEARNING_GAIN, 0.5)
    for _ in range(10):
        runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.LEARNING_GAIN, 0.5)
    run = runner.finalize(run, _experiment(metrics=[ExperimentMetric.LEARNING_GAIN]))
    assert ExperimentMetric.LEARNING_GAIN not in run.winner_per_metric


def test_experiment_runner_rejects_when_repeatability_evidence_fails():
    from v1.research import runner as runner_module
    from v1.research.experiment import ConfidenceInterval as CiClass

    real = runner_module.bootstrap_confidence_interval
    calls = {"count": 0}

    def unstable_bootstrap(samples, **kwargs):
        ci = real(samples, **kwargs)
        if ci is None:
            return None
        calls["count"] += 1
        if calls["count"] % 2 == 0:
            return CiClass(
                metric=ci.metric, arm=ci.arm,
                lower=-ci.upper, upper=-ci.lower, mean=-ci.mean, n=ci.n,
                excludes_zero=ci.excludes_zero,
            )
        return CiClass(
            metric=ci.metric, arm=ci.arm,
            lower=ci.lower, upper=ci.upper, mean=ci.mean, n=ci.n,
            excludes_zero=ci.excludes_zero,
        )

    runner_module.bootstrap_confidence_interval = unstable_bootstrap
    try:
        runner = ExperimentRunner()
        run = runner.new_run(_experiment(metrics=[ExperimentMetric.LEARNING_GAIN]))
        for _ in range(10):
            runner.record(run, ExperimentArm.D_FULL_STACK, ExperimentMetric.LEARNING_GAIN, 0.5)
        for _ in range(10):
            runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.LEARNING_GAIN, 0.5)
        with pytest.raises(InsufficientEvidence):
            runner.finalize(run, _experiment(metrics=[ExperimentMetric.LEARNING_GAIN]))
    finally:
        runner_module.bootstrap_confidence_interval = real


def test_experiment_runner_rejects_no_observations():
    runner = ExperimentRunner()
    run = runner.new_run(_experiment())
    with pytest.raises(InsufficientSessions):
        runner.finalize(run, _experiment())


def test_repeatability_evidence_is_stable_for_constant_samples():
    evidence = RepeatabilityEvidence(
        metric=ExperimentMetric.LEARNING_GAIN,
        arm=ExperimentArm.D_FULL_STACK,
        runs=3,
        bootstrap_means=[0.5, 0.5, 0.5],
    )
    assert evidence.is_stable()


def test_repeatability_evidence_unstable_for_high_variance_means():
    evidence = RepeatabilityEvidence(
        metric=ExperimentMetric.LEARNING_GAIN,
        arm=ExperimentArm.D_FULL_STACK,
        runs=3,
        bootstrap_means=[0.1, 0.9, 0.5],
    )
    assert not evidence.is_stable()


def test_repeatability_evidence_zero_mean_is_always_stable():
    evidence = RepeatabilityEvidence(
        metric=ExperimentMetric.LEARNING_GAIN,
        arm=ExperimentArm.D_FULL_STACK,
        runs=3,
        bootstrap_means=[0.0, 0.0, 0.0],
    )
    assert evidence.is_stable()


def test_repeatability_evidence_to_dict_includes_stable_flag():
    evidence = RepeatabilityEvidence(
        metric=ExperimentMetric.LEARNING_GAIN,
        arm=ExperimentArm.D_FULL_STACK,
        runs=3,
        bootstrap_means=[0.5, 0.5, 0.5],
    )
    payload = evidence.to_dict()
    assert payload["stable"] is True


def test_experiment_runner_full_workflow_with_two_metrics():
    runner = ExperimentRunner()
    experiment = _experiment(
        metrics=[
            ExperimentMetric.LEARNING_GAIN,
            ExperimentMetric.MASTERY_PROGRESSION,
        ]
    )
    run = runner.new_run(experiment)
    for _ in range(20):
        runner.record(run, ExperimentArm.D_FULL_STACK, ExperimentMetric.LEARNING_GAIN, 0.9)
    for _ in range(20):
        runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.LEARNING_GAIN, 0.4)
    for _ in range(20):
        runner.record(run, ExperimentArm.D_FULL_STACK, ExperimentMetric.MASTERY_PROGRESSION, 0.7)
    for _ in range(20):
        runner.record(run, ExperimentArm.A_STATIC_TUTOR, ExperimentMetric.MASTERY_PROGRESSION, 0.3)
    run = runner.finalize(run, experiment)
    assert run.completed_at is not None
    assert ExperimentMetric.LEARNING_GAIN in run.winner_per_metric
    assert ExperimentMetric.MASTERY_PROGRESSION in run.winner_per_metric


def test_four_arms_can_all_be_used_in_a_single_experiment_via_separate_runs():
    runner = ExperimentRunner()
    experiments = [
        _experiment_with_arm(treatment, control)
        for treatment, control in [
            (ExperimentArm.D_FULL_STACK, ExperimentArm.A_STATIC_TUTOR),
            (ExperimentArm.C_LEARNER_MODEL_MEMORY, ExperimentArm.B_LEARNER_MODEL),
            (ExperimentArm.D_FULL_STACK, ExperimentArm.B_LEARNER_MODEL),
            (ExperimentArm.B_LEARNER_MODEL, ExperimentArm.A_STATIC_TUTOR),
        ]
    ]
    for experiment in experiments:
        run = runner.new_run(experiment)
        for _ in range(20):
            runner.record(run, experiment.treatment, ExperimentMetric.LEARNING_GAIN, 0.8)
            runner.record(run, experiment.control, ExperimentMetric.LEARNING_GAIN, 0.4)
        run = runner.finalize(run, experiment)
        assert run.completed_at is not None


def _experiment_with_arm(treatment: ExperimentArm, control: ExperimentArm) -> Experiment:
    return Experiment(
        experiment_id=f"exp-{treatment.value}-{control.value}",
        hypothesis=f"{treatment.value} beats {control.value}",
        population=_population(),
        treatment=treatment,
        control=control,
        metrics=[ExperimentMetric.LEARNING_GAIN],
        duration_days=14,
    )


def test_experiment_rejects_zero_duration():
    with pytest.raises(ValueError):
        Experiment(
            experiment_id="exp-1",
            hypothesis="x",
            population=_population(),
            treatment=ExperimentArm.A_STATIC_TUTOR,
            control=ExperimentArm.B_LEARNER_MODEL,
            metrics=[ExperimentMetric.LEARNING_GAIN],
            duration_days=0,
        )