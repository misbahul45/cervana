import logging
from config.embedding_pipeline import get_embedding_pipeline
from utils.tools.memory import tool_memory_upsert, tool_semantic_search
from utils.tools.web_search import tool_web_search
from v1.users_steps.service import *
from v1.learning.service import *
from v1.learning.dto import GenerateContentMaterialPipeline
from langgraph.graph import StateGraph, START, END

logger = logging.getLogger(__name__)
pipeline = get_embedding_pipeline()


def parallel_fetch(state: GenerateContentMaterialPipeline) -> GenerateContentMaterialPipeline:
    token = state.token
    lesson = get_lesson(state.lessonId, token)
    state.lesson=lesson
    step = get_step(state.stepId, token)
    state.step = step
    topic = get_topic(state.topicId, token)
    state.topic = topic

    update_message_chat(state.messageId, state.token, {
        "text": f"Fetching data for Lesson: {state.lesson.title}, Step: {state.step.title}, Topic: {state.topic.title}",
        "status":"PROCESSING"
    })

    if state.learningStyleId:
        try:
            learningStyle = get_learning_style(state.learningStyleId, token)
            state.learningStyle = learningStyle
        except:
          logger.warning(f"Learning style with ID {state.learningStyleId} not found.")

    try:
        userStep = get_user_step(state.userStepId, token)
        print(userStep)
        state.userStep = userStep
    except:
        logger.warning(f"User step with ID {state.userStepId} not found.")

    return state


def prepare_learning_context(state: GenerateContentMaterialPipeline) -> GenerateContentMaterialPipeline:
    topic = state.topic
    lesson = state.lesson
    step = state.step
    user_step = state.userStep
    learning_style = state.learningStyle

    topic_title = topic.title if topic else "Unknown Topic"
    lesson_title = lesson.title if lesson else "Unknown Lesson"
    step_title = step.title if step else "Unknown Step"
    learning_style_str = learning_style.dominantStyle if learning_style else "Not Specified"

    update_message_chat(state.messageId, state.token, {
        "text": f"Preparing learning context for Topic: {topic_title}, Lesson: {lesson_title}, Step: {step_title}, materi pembelajaran/target topic pemahaman: {state.userStep.title}, Learning Style: {learning_style_str}"
    })

    prompt = f"""
You are an Instructional Design Expert.
Topic: {topic_title}
Lesson: {lesson_title}
Step: {step_title}
materi pembelajaran/target topic pemahaman: {state.userStep.title}
Learning Style: {learning_style_str}
Output: 3 sentences + bullet focused next + bullet learning plan
"""

    analysis = pipeline.llm.invoke(prompt).content.strip()
    state.analysis = analysis

    if state.userId and state.lessonId:
        tool_memory_upsert(userId=state.userId, lessonId=state.lessonId, text=analysis)

    memories = tool_semantic_search(userId=state.userId, lessonId=state.lessonId, top_k=15)
    merged_memory = "\n".join([m.get("text", "") for m in memories]) if memories else ""

    history_query = f"{topic_title} {lesson_title} {step_title} {learning_style_str}"

    try:
        history_results = query_content_history(chatId=state.chatId, q=history_query, token=state.token)
    except:
        history_results = []

    history_merged = "\n".join(
        [h.get("chunkText", "") for h in history_results if h.get("chunkText")]
    )

    final_context = f"""
[Learning Analysis]
{analysis}

[Memory]
{merged_memory}

[Content History]
{history_merged}
""".strip()

    state.context = final_context
    return state


def retrieve_material_rag(state: GenerateContentMaterialPipeline) -> str:
    query = f"{state.topic.title if state.topic else ''} {state.lesson.title if state.lesson else ''} {state.step.title if state.step else ''}"
    try:
        results = pipeline.retrieve(query=query, metadata_filter={"source": "material"}, top_k=10)
        update_message_chat(state.messageId, state.token, {
            "text": f"Retrieved {len(results)} RAG materials for query: {query}",
            "status":"PROCESSING"
        })
        return "\n".join([r["text"] for r in results]) if results else ""
    except:
        return ""


def retrieve_material_web(state: GenerateContentMaterialPipeline) -> str:
    try:
        query = f"{state.topic.title if state.topic else ''} {state.step.title if state.step else ''} learning material summary"
        update_message_chat(state.messageId, state.token, {
            "text": f"Performing web search for query: {query}",
            "status":"PROCESSING"
        })
        return tool_web_search(query, limit=5)
    except:
        return ""


def generate_material(state: GenerateContentMaterialPipeline) -> GenerateContentMaterialPipeline:
    rag = retrieve_material_rag(state)
    web = retrieve_material_web(state)

    update_message_chat(state.messageId, state.token, {
        "text": "Generating learning content based on current step.",
        "status":"PROCESSING"
    })

    topic_title = state.topic.title if state.topic else "Topik"
    lesson_title = state.lesson.title if state.lesson else "Pelajaran"
    step_title = state.step.title if state.step else "Sub Materi"
    learning_style = (
        state.learningStyle.dominantStyle
        if state.learningStyle else "Default"
    )

    prompt = f"""
Anda adalah *Pakar Materi Sertifikasi Profesi*.

🎯 Tujuan:
Menghasilkan *materi pembelajaran final* untuk peserta
berdasarkan kemajuan belajar mereka pada:

- Topik: **{topic_title}**
- Pelajaran: **{lesson_title}**
- Step / Kompetensi: **{step_title}**
- user_step/topic user yang harus dibahas : **{state.userStep.title}** dengan goalnya itu pada kompetisi**{state.step.title}**
- Gaya Belajar User: {learning_style}

Gunakan seluruh referensi berikut sebagai sumber:
=====================
📌 KONTEN SEBELUMNYA:
{state.context}

📌 MATERIAL ORGANISASI (RAG):
{rag}

📌 MATERIAL WEB:
{web}
=====================

📌 Ketentuan Materi:
- Bahasa Indonesia profesional & mudah dipahami
- Relevan langsung dengan **kompetensi step ini**
- Fokus pada *pengetahuan + praktik + contoh nyata*
- Struktur teratur
- Tidak berisi instruksi tugas kurikulum atau format desain lain
- Panjang: 300–700 kata
- Gunakan Markdown

📌 Struktur Wajib Output:
## {state.userStep.title}

### Mengapa Hal Ini Penting
(paragraf pendek)

### Materi Inti
- konsep utama
- aturan / rumus / prosedur terkait
- elemen penting
(boleh subheading jika perlu)

### Contoh Praktik di Dunia Kerja
(contoh yang sangat relevan dengan teknisi akuntansi)

### Latihan Singkat
3–5 soal singkat

### Ringkasan Kunci
3–7 poin

⚠ Tidak boleh menyinggung pembuatan kurikulum.
⚠ Output = *langsung materi belajar*, tanpa kata pembuka tambahan.
"""

    content = pipeline.llm.invoke(prompt).content.strip()
    state.generate = {
        "chatId": state.chatId,
        "chatMessageId": state.messageId,
        "data":content,
        "citatetions": [],
        "metadata": {
            "topicId": state.topicId,
            "lessonId": state.lessonId,
            "stepId": state.stepId,
            "userStepId": state.userStepId,
            "userId": state.userId,
        }
    }

    # Simpan memory agar personalisasi ke depan tetap konsisten
    if state.userId and state.lessonId:
        try:
            tool_memory_upsert(
                userId=state.userId,
                lessonId=state.lessonId,
                text=content
            )
        except Exception:
            pass

    return state


graph = StateGraph(GenerateContentMaterialPipeline)
graph.add_node("parallel_fetch", parallel_fetch)
graph.add_node("prepare_learning_context", prepare_learning_context)
graph.add_node("generate_material", generate_material)

graph.add_edge(START, "parallel_fetch")
graph.add_edge("parallel_fetch", "prepare_learning_context")
graph.add_edge("prepare_learning_context", "generate_material")
graph.add_edge("generate_material", END)

def generate_content_material_pipeline(state: GenerateContentMaterialPipeline) -> GenerateContentMaterialPipeline:
    compiled = graph.compile()
    res= compiled.invoke(state)
    update_message_chat(state.messageId, state.token, {
        "text": f"Content material generation completed successfully!",
        "status":"COMPLETED"
    })
    return res
