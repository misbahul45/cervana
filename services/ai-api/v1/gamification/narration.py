from __future__ import annotations

from typing import Any, Dict, Optional


CANONICAL_CELEBRATION_PHRASES = {
    "MASTERY_MILESTONE": "Selamat! Anda baru saja menguasai konsep ini. Lanjut ke tantangan berikutnya.",
    "VALIDATED_PRACTICE": "Latihan Anda tervalidasi. Terus pertahankan ritme ini.",
    "SCENARIO_SUCCESS": "Skenario kerja selesai dengan baik. Anda siap untuk skenario yang lebih kompleks.",
    "LEARNING_MILESTONE": "Pencapaian belajar Anda bertambah. Pertahankan konsistensinya.",
    "REJECT_DUPLICATE": "Aksi ini sudah pernah dicatat. Tidak ada reward tambahan.",
    "REJECT_REPLAY": "Skenario ini sudah Anda selesaikan baru saja. Coba lagi besok untuk latihan.",
    "REJECT_TOO_FAST": "Tempo Anda terlalu cepat untuk skenario ini. Pelan sedikit dan fokus.",
    "REJECT_LOGIN": "Aktivitas belajar Anda yang menentukan reward, bukan login.",
    "REJECT_CHAT": "Pesan chat tidak dihitung sebagai aktivitas belajar.",
}


def render_celebration(reason: str, *, fallback: str | None = None) -> str:
    return CANONICAL_CELEBRATION_PHRASES.get(reason, fallback or "Terima kasih sudah belajar hari ini.")


def render_narration_block(decision: Dict[str, Any]) -> str:
    """Render a celebration block from a reward decision.

    ai-api MUST NOT mutate, fabricate, or invent RewardDecisions. This helper
    only formats a decision it has been given by the authoritative api-side
    engine. The boundary test asserts that the AI cannot reach the api-side
    routes that produce RewardDecisions.
    """
    if not isinstance(decision, dict):
        raise TypeError("decision must be a dict from the api-side engine")
    if decision.get("eligible") is True and decision.get("amount", 0) > 0:
        reason = decision.get("reason", "")
        text = render_celebration(reason)
        return (
            "<celebration trust=\"immutable\">\n"
            f"{text}\n"
            f"+{decision['amount']} {decision.get('rewardKind', 'XP')}\n"
            f"</celebration>"
        )
    reason = decision.get("reason", "")
    text = render_celebration(reason)
    return (
        "<feedback trust=\"immutable\">\n"
        f"{text}\n"
        f"</feedback>"
    )


def narration_for_milestone(milestone_type: str) -> str:
    mapping = {
        "first_correct": "Langkah pertama yang benar. Teruskan.",
        "ten_in_a_row": "Sepuluh jawaban benar berturut-turut. Ritme Anda kuat.",
        "module_complete": "Modul ini selesai. Lanjut ke modul berikutnya.",
        "concepts_mastered_5": "Lima konsep dikuasai dengan kuat.",
        "concepts_mastered_10": "Sepuluh konsep dikuasai.",
    }
    return mapping.get(milestone_type, render_celebration("LEARNING_MILESTONE"))


__all__ = [
    "CANONICAL_CELEBRATION_PHRASES",
    "render_celebration",
    "render_narration_block",
    "narration_for_milestone",
]