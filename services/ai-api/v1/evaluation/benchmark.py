from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from v1.evaluation.dimensions import (
    DimensionName,
    ExpectationRubric,
)


BENCHMARK_VERSION = "benchmark-v1.0.0"


@dataclass(frozen=True)
class BenchmarkScenario:
    scenario_id: str
    difficulty: str
    category: str
    description: str
    user_query: str
    rubric: ExpectationRubric
    tutor_program: Optional[str] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenarioId": self.scenario_id,
            "difficulty": self.difficulty,
            "category": self.category,
            "description": self.description,
            "userQuery": self.user_query,
            "tutorProgram": self.tutor_program,
            "rubric": {
                "rubricId": self.rubric.rubric_id,
                "expectedDimensionFloors": {
                    k.value: v for k, v in self.rubric.expected_dimension_floors.items()
                },
                "expectedConcepts": list(self.rubric.expected_concepts),
                "forbiddenConcepts": list(self.rubric.forbidden_concepts),
                "notes": self.rubric.notes,
            },
            "notes": self.notes,
        }


def _concept_rubric(
    scenario_id: str,
    concepts: List[str],
    *,
    forbidden: Optional[List[str]] = None,
    floors: Optional[Dict[DimensionName, float]] = None,
    notes: str = "",
) -> ExpectationRubric:
    return ExpectationRubric(
        rubric_id=f"{scenario_id}-rubric",
        scenario_id=scenario_id,
        expected_dimension_floors=floors or {
            DimensionName.CONCEPTUAL_CORRECTNESS: 0.7,
            DimensionName.DOMAIN_TERMINOLOGY: 0.5,
            DimensionName.PREREQUISITE_AWARENESS: 0.5,
        },
        expected_concepts=concepts,
        forbidden_concepts=forbidden or [],
        notes=notes,
    )


def _journal_rubric(
    scenario_id: str,
    *,
    floors: Optional[Dict[DimensionName, float]] = None,
    notes: str = "",
) -> ExpectationRubric:
    return ExpectationRubric(
        rubric_id=f"{scenario_id}-rubric",
        scenario_id=scenario_id,
        expected_dimension_floors=floors or {
            DimensionName.DOUBLE_ENTRY_VALIDITY: 0.8,
            DimensionName.CALCULATION_CORRECTNESS: 0.8,
            DimensionName.CONCEPTUAL_CORRECTNESS: 0.7,
        },
        expected_concepts=["debit", "credit"],
        notes=notes,
    )


BENCHMARK_SCENARIOS: List[BenchmarkScenario] = [
    BenchmarkScenario(
        scenario_id="B01_double_entry_definition",
        difficulty="easy",
        category="concept_explanation",
        description="Define double-entry bookkeeping.",
        user_query="Apa itu double-entry bookkeeping?",
        rubric=_concept_rubric(
            "B01_double_entry_definition",
            ["double_entry", "debit", "credit"],
            forbidden=[],
            notes="must define double-entry; cite debit/credit",
        ),
    ),
    BenchmarkScenario(
        scenario_id="B02_accounting_equation",
        difficulty="easy",
        category="concept_explanation",
        description="State the accounting equation.",
        user_query="Sebutkan persamaan akuntansi.",
        rubric=_concept_rubric(
            "B02_accounting_equation",
            ["accounting_equation", "asset", "liability", "equity"],
            notes="accounting equation: A = L + E",
        ),
    ),
    BenchmarkScenario(
        scenario_id="B03_normal_balance_assets",
        difficulty="easy",
        category="concept_explanation",
        description="Identify the normal balance of asset accounts.",
        user_query="Apa normal balance akun aset?",
        rubric=_concept_rubric(
            "B03_normal_balance_assets",
            ["asset", "debit"],
            notes="asset normal balance is debit",
        ),
    ),
    BenchmarkScenario(
        scenario_id="B04_normal_balance_revenue",
        difficulty="easy",
        category="concept_explanation",
        description="Identify the normal balance of revenue accounts.",
        user_query="Apa normal balance akun pendapatan?",
        rubric=_concept_rubric(
            "B04_normal_balance_revenue",
            ["revenue", "credit"],
            notes="revenue normal balance is credit",
        ),
    ),
    BenchmarkScenario(
        scenario_id="B05_journal_entry_basics",
        difficulty="easy",
        category="concept_explanation",
        description="Explain journal entry basics.",
        user_query="Jelaskan apa itu journal entry.",
        rubric=_concept_rubric(
            "B05_journal_entry_basics",
            ["journal_entry", "debit", "credit"],
            notes="atomic balanced transaction",
        ),
    ),
    BenchmarkScenario(
        scenario_id="B06_trial_balance_purpose",
        difficulty="medium",
        category="concept_explanation",
        description="Explain the trial balance.",
        user_query="Untuk apa trial balance?",
        rubric=_concept_rubric(
            "B06_trial_balance_purpose",
            ["trial_balance", "balance"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B07_accrual_vs_cash",
        difficulty="medium",
        category="concept_explanation",
        description="Explain accrual vs cash basis.",
        user_query="Apa beda accrual vs cash basis?",
        rubric=_concept_rubric(
            "B07_accrual_vs_cash",
            ["accrual", "cash"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B08_adjusting_entries",
        difficulty="medium",
        category="concept_explanation",
        description="Explain adjusting entries.",
        user_query="Apa yang dimaksud dengan adjusting entries?",
        rubric=_concept_rubric(
            "B08_adjusting_entries",
            ["adjusting_entry"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B09_financial_statements_overview",
        difficulty="medium",
        category="concept_explanation",
        description="List the three main financial statements.",
        user_query="Sebutkan tiga laporan keuangan utama.",
        rubric=_concept_rubric(
            "B09_financial_statements_overview",
            ["financial_statements", "balance", "income"],
            forbidden=["cash_flow_dummy"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B10_revenue_recognition",
        difficulty="hard",
        category="concept_explanation",
        description="Explain revenue recognition principle.",
        user_query="Jelaskan prinsip pengakuan pendapatan.",
        rubric=_concept_rubric(
            "B10_revenue_recognition",
            ["revenue_recognition", "accrual"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B11_buy_equipment_cash",
        difficulty="easy",
        category="journal_entry",
        description="Buy equipment for IDR 5,000,000 with cash.",
        user_query="Buat jurnal pembelian peralatan tunai 5 juta.",
        rubric=_journal_rubric("B11_buy_equipment_cash"),
    ),
    BenchmarkScenario(
        scenario_id="B12_buy_supplies_on_credit",
        difficulty="easy",
        category="journal_entry",
        description="Buy supplies IDR 1,200,000 on credit.",
        user_query="Buat jurnal pembelian supplies 1,2jt secara kredit.",
        rubric=_journal_rubric("B12_buy_supplies_on_credit"),
    ),
    BenchmarkScenario(
        scenario_id="B13_provide_service_revenue",
        difficulty="easy",
        category="journal_entry",
        description="Provide service for IDR 2,500,000 cash.",
        user_query="Buat jurnal提供服务 2,5jt tunai.",
        rubric=_journal_rubric("B13_provide_service_revenue"),
    ),
    BenchmarkScenario(
        scenario_id="B14_pay_rent",
        difficulty="easy",
        category="journal_entry",
        description="Pay rent IDR 800,000 cash.",
        user_query="Buat jurnal bayar sewa 800rb tunai.",
        rubric=_journal_rubric("B14_pay_rent"),
    ),
    BenchmarkScenario(
        scenario_id="B15_receive_advance_from_customer",
        difficulty="medium",
        category="journal_entry",
        description="Receive IDR 3,000,000 advance from customer.",
        user_query="Buat jurnal terima uang muka 3jt.",
        rubric=_journal_rubric("B15_receive_advance_from_customer"),
    ),
    BenchmarkScenario(
        scenario_id="B16_accrue_salaries",
        difficulty="medium",
        category="journal_entry",
        description="Accrue salaries IDR 4,500,000.",
        user_query="Buat jurnal akru gaji 4,5jt.",
        rubric=_journal_rubric("B16_accrue_salaries"),
    ),
    BenchmarkScenario(
        scenario_id="B17_write_off_bad_debt",
        difficulty="medium",
        category="journal_entry",
        description="Write off bad debt IDR 750,000.",
        user_query="Buat jurnal hapus piutang tak tertagih 750rb.",
        rubric=_journal_rubric("B17_write_off_bad_debt"),
    ),
    BenchmarkScenario(
        scenario_id="B18_accrue_interest",
        difficulty="medium",
        category="journal_entry",
        description="Accrue interest IDR 250,000.",
        user_query="Buat jurnal akru bunga 250rb.",
        rubric=_journal_rubric("B18_accrue_interest"),
    ),
    BenchmarkScenario(
        scenario_id="B19_record_depreciation",
        difficulty="medium",
        category="journal_entry",
        description="Record IDR 500,000 monthly depreciation.",
        user_query="Buat jurnal penyusutan bulanan 500rb.",
        rubric=_journal_rubric("B19_record_depreciation"),
    ),
    BenchmarkScenario(
        scenario_id="B20_close_revenue_to_income_summary",
        difficulty="hard",
        category="journal_entry",
        description="Close revenue accounts to income summary.",
        user_query="Tutup akun pendapatan ke ikhtisar laba rugi.",
        rubric=_journal_rubric("B20_close_revenue_to_income_summary"),
    ),
    BenchmarkScenario(
        scenario_id="B21_debit_revenue_misconception",
        difficulty="medium",
        category="error_diagnosis",
        description="Identify the error when a student debits revenue.",
        user_query="Apa kesalahan jika siswa mendebit akun pendapatan untuk menambahnya?",
        rubric=_concept_rubric(
            "B21_debit_revenue_misconception",
            ["normal_balance", "credit"],
            forbidden=["debit_to_increase_revenue"],
            notes="must explain that revenue increases with credit, not debit",
        ),
    ),
    BenchmarkScenario(
        scenario_id="B22_unbalanced_entry_diagnosis",
        difficulty="easy",
        category="error_diagnosis",
        description="Diagnose why a journal entry is rejected.",
        user_query="Mengapa jurnal dengan debit 1jt dan kredit 900rb ditolak?",
        rubric=_concept_rubric(
            "B22_unbalanced_entry_diagnosis",
            ["double_entry", "debit", "credit"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B23_contra_account_error",
        difficulty="medium",
        category="error_diagnosis",
        description="Diagnose misuse of accumulated depreciation as debit.",
        user_query="Apa masalah jika akumulasi penyusutan dianggap memiliki saldo debit?",
        rubric=_concept_rubric(
            "B23_contra_account_error",
            ["contra_account", "credit"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B24_invalid_account_code",
        difficulty="easy",
        category="error_diagnosis",
        description="Diagnose rejection due to account 9999.",
        user_query="Mengapa akun 9999 ditolak?",
        rubric=_concept_rubric(
            "B24_invalid_account_code",
            ["account"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B25_negative_amount_rejected",
        difficulty="easy",
        category="error_diagnosis",
        description="Diagnose negative amount rejection.",
        user_query="Mengapa jumlah negatif ditolak?",
        rubric=_concept_rubric(
            "B25_negative_amount_rejected",
            ["amount"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B26_wrong_period_rejected",
        difficulty="medium",
        category="error_diagnosis",
        description="Diagnose closed-period rejection.",
        user_query="Mengapa posting ke periode tertutup gagal?",
        rubric=_concept_rubric(
            "B26_wrong_period_rejected",
            ["period"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B27_missing_currency_unit",
        difficulty="medium",
        category="error_diagnosis",
        description="Identify missing currency-unit annotation.",
        user_query="Bagaimana cara mendeteksi jumlah tanpa mata uang?",
        rubric=_concept_rubric(
            "B27_missing_currency_unit",
            ["amount", "currency"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B28_decimal_precision_violation",
        difficulty="medium",
        category="error_diagnosis",
        description="Diagnose decimal-place violation.",
        user_query="Bagaimana mendeteksi pelanggaran presisi desimal?",
        rubric=_concept_rubric(
            "B28_decimal_precision_violation",
            ["decimal"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B29_wrong_rule_lookup",
        difficulty="medium",
        category="error_diagnosis",
        description="Diagnose unknown rule lookup.",
        user_query="Mengapa rule_id tidak dikenal?",
        rubric=_concept_rubric(
            "B29_wrong_rule_lookup",
            ["rule"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B30_forgetting_reversing_entry",
        difficulty="hard",
        category="error_diagnosis",
        description="Diagnose forgetting reversing entries.",
        user_query="Apa akibat jika reversing entries terlewat?",
        rubric=_concept_rubric(
            "B30_forgetting_reversing_entry",
            ["adjusting_entry", "reversing"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B31_case_two_step_purchase_and_payment",
        difficulty="medium",
        category="case_analysis",
        description="Case: buy on credit then pay within discount period.",
        user_query="Skenario pembelian kredit dan pembayaran dalam periode diskon.",
        rubric=_concept_rubric(
            "B31_case_two_step_purchase_and_payment",
            ["debit", "credit", "asset"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B32_case_three_step_revenue_recognition",
        difficulty="hard",
        category="case_analysis",
        description="Three-step case: invoice, receive cash, defer revenue.",
        user_query="Skenario pengakuan pendapatan 3 langkah.",
        rubric=_concept_rubric(
            "B32_case_three_step_revenue_recognition",
            ["revenue_recognition", "debit", "credit"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B33_case_inventory_purchase",
        difficulty="medium",
        category="case_analysis",
        description="Inventory purchase and sale case.",
        user_query="Skenario pembelian dan penjualan persediaan.",
        rubric=_concept_rubric(
            "B33_case_inventory_purchase",
            ["asset", "expense"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B34_case_payroll_with_taxes",
        difficulty="hard",
        category="case_analysis",
        description="Payroll with withholding taxes case.",
        user_query="Skenario gaji dengan pajak.",
        rubric=_concept_rubric(
            "B34_case_payroll_with_taxes",
            ["liability", "expense"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B35_case_accrued_revenue",
        difficulty="hard",
        category="case_analysis",
        description="Accrued revenue case.",
        user_query="Skenario pendapatan yang masih harus diterima.",
        rubric=_concept_rubric(
            "B35_case_accrued_revenue",
            ["accrual", "revenue"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B36_case_revaluation_of_fixed_asset",
        difficulty="hard",
        category="case_analysis",
        description="Revaluation of fixed asset case.",
        user_query="Skenario revaluasi aset tetap.",
        rubric=_concept_rubric(
            "B36_case_revaluation_of_fixed_asset",
            ["asset", "revaluation"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B37_case_bank_reconciliation",
        difficulty="medium",
        category="case_analysis",
        description="Bank reconciliation case.",
        user_query="Skenario rekonsiliasi bank.",
        rubric=_concept_rubric(
            "B37_case_bank_reconciliation",
            ["bank", "balance"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B38_case_disposal_of_asset",
        difficulty="hard",
        category="case_analysis",
        description="Disposal of fixed asset case.",
        user_query="Skenario pelepasan aset tetap.",
        rubric=_concept_rubric(
            "B38_case_disposal_of_asset",
            ["asset", "disposal"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B39_case_lease_maturity_income_statement",
        difficulty="hard",
        category="case_analysis",
        description="Operating lease case and income statement effect.",
        user_query="Skenario sewa operasi dan dampaknya ke laporan laba rugi.",
        rubric=_concept_rubric(
            "B39_case_lease_maturity_income_statement",
            ["expense", "income"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B40_case_intercompany_elimination",
        difficulty="hard",
        category="case_analysis",
        description="Intercompany elimination case.",
        user_query="Skenario eliminasi antar perusahaan.",
        rubric=_concept_rubric(
            "B40_case_intercompany_elimination",
            ["intercompany", "elimination"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B41_multi_step_period_end",
        difficulty="hard",
        category="multi_step",
        description="Multi-step period-end closing.",
        user_query="Penutupan akhir periode multi-langkah.",
        rubric=_concept_rubric(
            "B41_multi_step_period_end",
            ["adjusting_entry", "closing"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B42_multi_step_bank_reconciliation",
        difficulty="hard",
        category="multi_step",
        description="Multi-step bank reconciliation.",
        user_query="Rekonsiliasi bank multi-langkah.",
        rubric=_concept_rubric(
            "B42_multi_step_bank_reconciliation",
            ["bank", "balance"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B43_multi_step_receivable_collection",
        difficulty="hard",
        category="multi_step",
        description="Multi-step receivable collection with allowance.",
        user_query="Penagihan piutang multi-langkah dengan allowance.",
        rubric=_concept_rubric(
            "B43_multi_step_receivable_collection",
            ["receivable", "allowance"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B44_multi_step_inventory_closing",
        difficulty="hard",
        category="multi_step",
        description="Multi-step inventory closing.",
        user_query="Penutupan persediaan multi-langkah.",
        rubric=_concept_rubric(
            "B44_multi_step_inventory_closing",
            ["inventory", "closing"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B45_multi_step_fixed_asset_depreciation",
        difficulty="hard",
        category="multi_step",
        description="Multi-step fixed asset depreciation across years.",
        user_query="Penyusutan aset tetap multi-tahun.",
        rubric=_concept_rubric(
            "B45_multi_step_fixed_asset_depreciation",
            ["depreciation", "asset"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B46_misconception_repair_contra",
        difficulty="medium",
        category="misconception_repair",
        description="Repair contra-account misconception.",
        user_query="Bagaimana memperbaiki miskonseva akun kontra?",
        rubric=_concept_rubric(
            "B46_misconception_repair_contra",
            ["contra_account", "credit"],
            forbidden=["contra_adds_to_parent"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B47_misconception_repair_debit_credit",
        difficulty="medium",
        category="misconception_repair",
        description="Repair debit/credit direction misconception.",
        user_query="Bagaimana memperbaiki miskonseva arah debit/kredit?",
        rubric=_concept_rubric(
            "B47_misconception_repair_debit_credit",
            ["normal_balance"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B48_misconception_repair_adjusting",
        difficulty="hard",
        category="misconception_repair",
        description="Repair adjusting-entry misconception.",
        user_query="Bagaimana memperbaiki miskonseva adjusting entry?",
        rubric=_concept_rubric(
            "B48_misconception_repair_adjusting",
            ["adjusting_entry"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B49_misconception_repair_mapping",
        difficulty="hard",
        category="misconception_repair",
        description="Repair statement mapping misconception.",
        user_query="Bagaimana memperbaiki miskonseva pemetaan laporan?",
        rubric=_concept_rubric(
            "B49_misconception_repair_mapping",
            ["financial_statements"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B50_misconception_repair_multi_step",
        difficulty="hard",
        category="misconception_repair",
        description="Repair multi-step case reasoning misconception.",
        user_query="Bagaimana memperbaiki miskonseva penalaran multi-langkah?",
        rubric=_concept_rubric(
            "B50_misconception_repair_multi_step",
            ["multi_step"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B51_rag_grounded_definition",
        difficulty="easy",
        category="rag_grounding",
        description="RAG-grounded definition: explain accrued expense.",
        user_query="Jelaskan accrued expense dengan bukti RAG.",
        rubric=_concept_rubric(
            "B51_rag_grounded_definition",
            ["accrual", "expense", "liability"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B52_rag_grounded_journal",
        difficulty="medium",
        category="rag_grounding",
        description="RAG-grounded journal entry construction.",
        user_query="Buat jurnal accrual berdasarkan dokumen sumber.",
        rubric=_concept_rubric(
            "B52_rag_grounded_journal",
            ["accrual", "debit", "credit"],
        ),
    ),
    BenchmarkScenario(
        scenario_id="B53_personalization_low_mastery",
        difficulty="medium",
        category="personalized_tutoring",
        description="Low-mastery learner asks a question.",
        user_query="Saya bingung dengan debit/kredit, jelaskan pelan-pelan.",
        rubric=_concept_rubric(
            "B53_personalization_low_mastery",
            ["debit", "credit"],
            notes="tutor should adapt: scaffolding=HIGH, hint level >=1",
            floors={
                DimensionName.PERSONALIZATION: 0.8,
                DimensionName.PEDAGOGY: 0.7,
            },
        ),
    ),
    BenchmarkScenario(
        scenario_id="B54_personalization_misconception",
        difficulty="medium",
        category="personalized_tutoring",
        description="Misconception detected, tutor uses repair strategy.",
        user_query="Saya kira contra account bertambah ke akun utama.",
        rubric=_concept_rubric(
            "B54_personalization_misconception",
            ["contra_account", "credit"],
            notes="tutor should select MISCONCEPTION_REPAIR + HIGH scaffolding",
            floors={
                DimensionName.MISCONCEPTION_HANDLING: 0.8,
            },
        ),
    ),
]


__all__ = [
    "BENCHMARK_VERSION",
    "BenchmarkScenario",
    "BENCHMARK_SCENARIOS",
    "_concept_rubric",
    "_journal_rubric",
]