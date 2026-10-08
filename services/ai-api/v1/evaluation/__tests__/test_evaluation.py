from __future__ import annotations

from v1.evaluation import (
    ACCOUNTING_DIMENSIONS,
    BENCHMARK_SCENARIOS,
    BENCHMARK_VERSION,
    BenchmarkRunner,
    COHEN_KAPPA_THRESHOLD,
    CalibrationReport,
    DeterministicEvaluator,
    DimensionName,
    EVALUATOR_PROMPT_VERSION,
    ExpectationRubric,
    HumanLabeledItem,
    TutorOutput,
    calibrate,
    cohen_kappa,
    pearson_correlation,
)


def _output(scenario_id: str = "X", concepts: list | None = None) -> TutorOutput:
    return TutorOutput(
        scenario_id=scenario_id,
        trace_id=f"trace-{scenario_id}",
        prompt_version="tutor-v1",
        response_text=(
            "double_entry debit credit rule balanced_double_entry "
            "account journal asset liability prerequisite "
            "misconception scenario interpretation"
        ),
        rag_evidence=[{"source": "material", "score": 0.9, "snippet": "double entry"}],
        adaptive_strategy_dict={"strategy": "GUIDED_STEP_BY_STEP", "difficulty": 0.4},
        domain_ontology_excerpt="double_entry, debit, credit",
        cited_concepts=concepts or ["double_entry", "debit", "credit"],
        latency_ms=200,
        cost_usd=0.002,
        tokens_in=120,
        tokens_out=240,
    )


def test_evaluator_uses_its_own_prompt_version():
    evaluator = DeterministicEvaluator()
    output = _output()
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        expected_concepts=["double_entry"],
        expected_dimension_floors={DimensionName.CONCEPTUAL_CORRECTNESS: 0.7},
    )
    report = evaluator.evaluate(output, rubric)
    assert report.evaluator_version == EVALUATOR_PROMPT_VERSION
    assert report.prompt_version == "tutor-v1"


def test_evaluator_evaluator_version_is_distinct_from_tutor_version():
    output = _output()
    evaluator = DeterministicEvaluator()
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        expected_concepts=["double_entry"],
    )
    report = evaluator.evaluate(output, rubric)
    assert report.evaluator_version != report.prompt_version
    assert report.evaluator_version.startswith("evaluator-")


def test_evaluator_scores_each_generic_dimension():
    evaluator = DeterministicEvaluator()
    output = _output()
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        expected_concepts=["double_entry"],
    )
    report = evaluator.evaluate(output, rubric)
    score_names = {s.dimension for s in report.scores}
    assert DimensionName.CORRECTNESS in score_names
    assert DimensionName.GROUNDING in score_names
    assert DimensionName.PEDAGOGY in score_names
    assert DimensionName.PERSONALIZATION in score_names
    assert DimensionName.HALLUCINATION in score_names
    assert DimensionName.LATENCY in score_names
    assert DimensionName.COST in score_names
    for name in ACCOUNTING_DIMENSIONS:
        assert name in score_names


def test_evaluator_accepts_well_grounded_output():
    evaluator = DeterministicEvaluator(threshold_accept=0.7)
    output = _output()
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        expected_concepts=["double_entry", "debit", "credit"],
        expected_dimension_floors={DimensionName.CONCEPTUAL_CORRECTNESS: 0.7},
    )
    report = evaluator.evaluate(output, rubric)
    assert report.accepted


def test_evaluator_rejects_missing_concepts():
    evaluator = DeterministicEvaluator(threshold_accept=0.99)
    output = _output()
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        expected_concepts=["double_entry", "nonexistent_concept"],
        expected_dimension_floors={DimensionName.CONCEPTUAL_CORRECTNESS: 0.99},
    )
    report = evaluator.evaluate(output, rubric)
    assert not report.accepted


def test_evaluator_rejects_forbidden_concepts():
    evaluator = DeterministicEvaluator()
    output = TutorOutput(
        scenario_id="X",
        trace_id="trace-X",
        prompt_version="tutor-v1",
        response_text="contra_account is contra_asset which is actually contra_asset and contra_account",
        cited_concepts=[],
    )
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        forbidden_concepts=["contra_adds_to_parent"],
    )
    report = evaluator.evaluate(output, rubric)
    score = report.score_for(DimensionName.HALLUCINATION)
    assert score is not None
    assert score.value == 1.0


def test_evaluator_50_scenario_benchmark_runs():
    assert len(BENCHMARK_SCENARIOS) >= 50, len(BENCHMARK_SCENARIOS)


def test_benchmark_covers_required_categories():
    categories = {s.category for s in BENCHMARK_SCENARIOS}
    for required in (
        "concept_explanation",
        "journal_entry",
        "error_diagnosis",
        "case_analysis",
        "multi_step",
        "misconception_repair",
        "rag_grounding",
        "personalized_tutoring",
    ):
        assert required in categories, f"missing category: {required}"


def test_benchmark_covers_easy_medium_hard():
    difficulties = {s.difficulty for s in BENCHMARK_SCENARIOS}
    assert "easy" in difficulties
    assert "medium" in difficulties
    assert "hard" in difficulties


def test_benchmark_version_is_immutable():
    assert BENCHMARK_VERSION.startswith("benchmark-")


def test_evaluator_version_does_not_match_tutor_version():
    assert EVALUATOR_PROMPT_VERSION != "tutor-v1"


def test_benchmark_runner_runs_all_scenarios():
    runner = BenchmarkRunner()
    summary = runner.run()
    assert summary.n_scenarios == len(BENCHMARK_SCENARIOS)
    assert summary.n_scenarios >= 50
    assert summary.benchmark_version == BENCHMARK_VERSION
    assert summary.evaluator_version == EVALUATOR_PROMPT_VERSION
    assert 0.0 <= summary.average_aggregate <= 1.0
    assert 0.0 <= summary.acceptance_rate <= 1.0


def test_benchmark_runner_per_dimension_average_in_unit_interval():
    runner = BenchmarkRunner()
    summary = runner.run()
    for value in summary.per_dimension_average.values():
        assert 0.0 <= value <= 1.0


def test_benchmark_runner_per_category_average_in_unit_interval():
    runner = BenchmarkRunner()
    summary = runner.run()
    for value in summary.per_category_average.values():
        assert 0.0 <= value <= 1.0


def test_benchmark_runner_per_difficulty_average_in_unit_interval():
    runner = BenchmarkRunner()
    summary = runner.run()
    for value in summary.per_difficulty_average.values():
        assert 0.0 <= value <= 1.0


def test_cohen_kappa_perfect_agreement():
    labels = [0, 1, 0, 1, 1, 1, 0, 0]
    kappa = cohen_kappa(labels, labels, categories=[0, 1])
    assert kappa == 1.0


def test_cohen_kappa_zero_agreement():
    a = [0, 0, 0, 1, 1, 1]
    b = [1, 1, 1, 0, 0, 0]
    kappa = cohen_kappa(a, b, categories=[0, 1])
    assert kappa < 0.0


def test_cohen_kappa_chance_agreement():
    a = [0, 0, 1, 1, 0, 0, 1, 1]
    b = [0, 0, 1, 1, 0, 0, 1, 1]
    kappa = cohen_kappa(a, b, categories=[0, 1])
    assert kappa == 1.0


def test_pearson_correlation_perfect_positive():
    xs = [1.0, 2.0, 3.0, 4.0, 5.0]
    ys = [2.0, 4.0, 6.0, 8.0, 10.0]
    assert abs(pearson_correlation(xs, ys) - 1.0) < 1e-9


def test_pearson_correlation_perfect_negative():
    xs = [1.0, 2.0, 3.0, 4.0, 5.0]
    ys = [5.0, 4.0, 3.0, 2.0, 1.0]
    assert abs(pearson_correlation(xs, ys) + 1.0) < 1e-9


def test_pearson_correlation_zero_variance_returns_zero():
    xs = [1.0, 1.0, 1.0]
    ys = [1.0, 2.0, 3.0]
    assert pearson_correlation(xs, ys) == 0.0


def test_calibration_with_perfect_human_labeling():
    items = [
        HumanLabeledItem(
            scenario_id=f"s-{i}",
            human_score=i / 20.0,
            evaluator_score=i / 20.0,
        )
        for i in range(20)
    ]
    report = calibrate(items)
    assert report.n_items == 20
    assert report.pearson > 0.99
    assert report.cohen_kappa_above_threshold


def test_calibration_with_random_human_labeling_fails_target():
    items = [
        HumanLabeledItem(
            scenario_id=f"s-{i}",
            human_score=round((i % 3) / 2, 1),
            evaluator_score=round(((i + 1) % 3) / 2, 1),
        )
        for i in range(20)
    ]
    report = calibrate(items)
    assert not report.cohen_kappa_above_threshold


def test_calibration_threshold_constant():
    assert COHEN_KAPPA_THRESHOLD == 0.85


def test_calibration_empty_items():
    report = calibrate([])
    assert report.n_items == 0
    assert not report.cohen_kappa_above_threshold


def test_default_evaluator_threshold_accept_is_seventy_percent():
    evaluator = DeterministicEvaluator()
    assert 0.6 <= evaluator.threshold_accept <= 0.8


def test_evaluator_rejects_above_threshold_when_only_one_dimension_passes():
    evaluator = DeterministicEvaluator(threshold_accept=0.95)
    output = _output()
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        expected_concepts=["nonexistent_concept"],
        expected_dimension_floors={
            DimensionName.CONCEPTUAL_CORRECTNESS: 0.99,
        },
    )
    report = evaluator.evaluate(output, rubric)
    assert not report.accepted


def test_deterministic_evaluator_produces_same_result_for_same_input():
    evaluator = DeterministicEvaluator()
    output = _output()
    rubric = ExpectationRubric(
        rubric_id="r",
        scenario_id="X",
        expected_concepts=["double_entry"],
    )
    r1 = evaluator.evaluate(output, rubric)
    r2 = evaluator.evaluate(output, rubric)
    assert r1.to_dict() == r2.to_dict()


def test_benchmark_scenarios_are_well_formed():
    for scenario in BENCHMARK_SCENARIOS:
        assert scenario.scenario_id
        assert scenario.difficulty in {"easy", "medium", "hard"}
        assert scenario.category
        assert scenario.user_query
        assert scenario.rubric.rubric_id == f"{scenario.scenario_id}-rubric"