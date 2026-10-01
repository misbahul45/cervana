from v1.users_steps.service import get_learning_style, get_steps, get_topic
from langgraph.graph import StateGraph, START, END
from typing import Optional, List, Any
from pydantic import BaseModel
import json
from v1.users_steps.dto import TopicBase, StepBase, LearningStyleProfileBase, QuizItem, QuizResponse
from utils.text import text_clean
from config.embedding_pipeline import get_embedding_pipeline
from v1.users_steps.dto import GenerateQuestionPipeline

def pararel_fetch(state: GenerateQuestionPipeline):
    topic = get_topic(state.topicId, state.token)
    steps = get_steps(state.lessonId, state.token)
    learning_style = get_learning_style(state.learningStyleId, state.token)
    return {"topic": topic, "steps": steps, "learningStyle": learning_style}

def process_results(state: GenerateQuestionPipeline):
    topic_text = f"topic title: {state.topic.title}\ntopic description: {state.topic.description or ''}" if state.topic else ""
    step_text = " ".join([f"step: {s.title}. description: {s.description or ''}" for s in state.steps]) if state.steps else ""
    ls_text = f"learning style visual:{state.learningStyle.visual}, auditory:{state.learningStyle.auditory}, reading:{state.learningStyle.reading}, kinesthetic:{state.learningStyle.kinesthetic}, dominant:{state.learningStyle.dominantStyle}" if state.learningStyle else ""
    raw = f"=== TOPIC ===\n{topic_text}\n=== STEPS ===\n{step_text}\n=== LEARNING PROFILE ===\n{ls_text}"
    cleaned = text_clean(raw)
    return {"context": cleaned}


def analyze_text(state: GenerateQuestionPipeline) -> QuizResponse:
    pipeline = get_embedding_pipeline()

    # --- Generate Summary ---
    summary_prompt = (
        "Ringkas materi berikut dalam bahasa Indonesia dengan singkat, jelas, "
        "tanpa opini tambahan, dan hanya fokus pada inti:\n\n"
        f"{state.context}"
    )
    summary_raw = pipeline.llm.invoke([
        {"role": "user", "content": summary_prompt}
    ])
    summary = summary_raw.content.strip()

    # --- Save to vector DB ---
    source_id = f"{state.topicId}-{state.lessonId}-{getattr(state, 'userId', 'unknown')}"
    pipeline.upsert_document(
        content=summary,
        source_id=source_id,
        metadata={
            "topicId": state.topicId,
            "lessonId": state.lessonId,
            "userId": getattr(state, "userId", "unknown"),
        },
    )

    # --- Retrieve RAG context ---
    retrieval_results = pipeline.retrieve(query=summary, top_k=10)
    rag_context = "\n".join([r["text"] for r in retrieval_results]) or ""
    ls = getattr(state.learningStyle, "dominantStyle", "reading")

    # =====================================================================
    # ====================== QUIZ PROMPT (SAFE VERSION) ====================
    # =====================================================================
    quiz_prompt = f"""
<system_role>
Anda adalah **Professional Certification Exam Developer**.
Tugas Anda: Membuat 10 Soal Simulasi Dunia Kerja (Workplace Simulation) untuk persiapan sertifikasi.

**PRINSIP UTAMA (CRITICAL):**
1.  **Workplace Reality First:** Soal harus mensimulasikan tantangan nyata di tempat kerja.
    -   *Bukan:* "Apa definisi X?"
    -   *Melainkan:* "Klien marah karena X, manajer sedang cuti, apa keputusan profesional Anda?"
2.  **Material-Bound:** Soal harus menguji penerapan dari `{summary}`. Jangan keluar dari scope materi tersebut.
3.  **HOTS (High Order Thinking Skills):**
    -   Untuk level **Hard/Hots**, uji kemampuan: **Diagnosa Masalah, Pengambilan Keputusan Strategis, Prioritas, atau Etika Profesi**.
    -   Jawaban tidak boleh sekadar hitam-putih, tapi memilih solusi *terbaik* dari opsi yang mungkin membingungkan (trade-off).
4.  **Flexible Markdown Context:**
    -   Gunakan format visual **HANYA JIKA RELEVAN** dengan tugasnya.
    -   Jika materi tentang *Data/Teknis* -> Gunakan **Tabel/Log/Code**.
    -   Jika materi tentang *Manajemen/Komunikasi* -> Gunakan **Email Thread/Dialog Script/Kutipan Regulasi**.
    -   Intinya: Tampilkan informasi seperti bagaimana user akan melihatnya di dunia nyata.
5. **Learning Style Adaptation:** Sesuaikan gaya soal berdasarkan profil belajar:
    - Visual: Gunakan deskripsi yang menggambarkan elemen visual.
    - Auditory: Gunakan dialog atau kutipan lisan.
    - Reading/Writing: Gunakan teks informatif, definisi, dan bullet points.
    - Kinesthetic: Gunakan contoh nyata dan konteks praktis.
    -dominantStyle adalah salah satu dari: visual, auditory, reading_writing, kinesthetic.
6.  **Bahasa Indonesia Profesional:** Gunakan bahasa Indonesia yang formal, profesional, dan sesuai konteks bisnis/sertifikasi.
7. **Konteks Lengkap dalam Soal:** Setiap `question` harus self-contained, memuat semua konteks cerita (judul situasi, deskripsi/data, pertanyaan inti).
8. **Variasi Tingkat Kesulitan:** Campurkan soal dengan tingkat kesulitan: Easy (2 soal), Medium (4 soal), Hard/HOTS (4 soal).
9. **Jenis Soal Beragam:** Gunakan variasi jenis soal: Multiple Choice, Input, Matching, Scenario-Based.    
10 jangan keluar dari materi dan konteks yang diberikan, benar benar fokus itu.

**STRUKTUR OUTPUT (Pydantic Compliance):**
Output WAJIB JSON valid dengan skema berikut:
{{
  "quiz": [
    {{
      "question": "String (GABUNGAN LENGKAP: Judul Situasi + Deskripsi/Data + Pertanyaan Inti)",
      "type": "multiple_choice | input | matching | scenario",
      "difficulty": "easy | medium | hard | hots",
      "options": ["String A", "String B", ...], // Array of Strings. Kosongkan [] jika input/scenario.
      "answer": "String (Kunci jawaban atau poin-poin rubrik penilaian)"
    }}
  ]
}}
</system_role>

<context>
**Learning Profile:** {ls}
**Materi Sertifikasi (Steps):** {summary}
**Knowledge Base:** {rag_context}
</context>

<example_style>
/* CONTOH 1: HARD (Tanpa Tabel - Fokus Strategi/Komunikasi) */
{{
  "question": "### ⚠️ Situasi: Eskalasi Keluhan Klien\\nAnda menerima email keluhan berat dari klien VIP terkait keterlambatan proyek (Materi Step 3: Crisis Mgmt).\\n\\n> 'Saya sangat kecewa. Jika tidak selesai besok, kontrak batal!'\\n\\nSecara teknis, tim butuh 2 hari lagi. Sebagai Project Lead, bagaimana respon negosiasi terbaik yang tetap menjaga integritas profesional?",
  "type": "multiple_choice",
  "difficulty": "hots",
  "options": [
    "Menjanjikan selesai besok demi menenangkan klien (walau mustahil)",
    "Mengajukan pengiriman parsial (fitur utama dulu) besok, sisanya lusa",
    "Menyalahkan tim teknis di depan klien agar perusahaan aman"
  ],
  "answer": "Mengajukan pengiriman parsial (fitur utama dulu) besok, sisanya lusa"
}}

/* CONTOH 2: HOTS (Dengan Tabel - Fokus Analisis Data) */
{{
  "question": "### 📉 Situasi: Audit Keuangan\\nSaat melakukan rekonsiliasi (Materi Step 5), Anda menemukan anomali berikut:\\n\\n| Transaksi | Buku Besar | Rekening Koran |\\n|---|---|---|\\n| #TX99 | Rp 5.000.000 | Rp 500.000 |\\n\\nNilai selisih material. Apa langkah audit pertama yang harus dilakukan sebelum membuat jurnal koreksi?",
  "type": "scenario",
  "difficulty": "hots",
  "options": [],
  "answer": "Memverifikasi bukti transaksi asli (invoice/struk) untuk menentukan sisi mana yang salah catat (Human Error vs Bank Error)."
}}
</example_style>

<trigger>
Generate 5 soal sekarang.
Ingat: `question` harus self-contained (memuat semua konteks cerita).
Sesuaikan penggunaan Markdown (Tabel/Email/Dialog) dengan kewajaran situasi kerjanya.
Output JSON only.
</trigger>
"""

    # =====================================================================
    # ===================== SEND TO LLM STRUCTURED OUTPUT =================
    # =====================================================================

    structured_llm = pipeline.llm.with_structured_output(QuizResponse)

    try:
        response = structured_llm.invoke([{"role": "user", "content": quiz_prompt}])
        parsed = QuizResponse.model_validate(response)
    except Exception:
        parsed = QuizResponse(quiz=[])

    return parsed

user_steps_pipeline = StateGraph(GenerateQuestionPipeline)
user_steps_pipeline.add_node("parallel_fetch", pararel_fetch)
user_steps_pipeline.add_node("process_results", process_results)
user_steps_pipeline.add_node("analyze_text", analyze_text)
user_steps_pipeline.add_edge(START, "parallel_fetch")
user_steps_pipeline.add_edge("parallel_fetch", "process_results")
user_steps_pipeline.add_edge("process_results", "analyze_text")
user_steps_pipeline.add_edge("analyze_text", END)
graph = user_steps_pipeline.compile()