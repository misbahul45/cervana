from v1.users_steps.dto import *
from config.envs import ENVS
import logging
import requests

def get_steps(lessonId: str, token: str) -> list[StepBase]:
    url = f"{ENVS['NEST_API']}/curriculum/steps?lessonId={lessonId}&sort=sortOrder:asc"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[STEP][GET] {url}")

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()

    data = res.json()["data"]['data']
    return [StepBase(**item) for item in data]

def get_step(step_id: str, token: str) -> StepBase:
    url = f"{ENVS['NEST_API']}/curriculum/steps/{step_id}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[STEP][GET ONE] {url}")

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()

    data = res.json()["data"]
    return StepBase(**data)


def get_topic(topicId: str, token: str) -> TopicBase:
    url = f"{ENVS['NEST_API']}/curriculum/topics?id={topicId}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[TOPIC][GET] {url}")

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()

    data = res.json()["data"]['data'][0]
    return TopicBase(**data)


def get_learning_style(learningStyleId: str, token: str) -> LearningStyleProfileBase:
    url = f"{ENVS['NEST_API']}/learning/learning-styles/{learningStyleId}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[LEARNING_STYLE][GET] {url}")

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()

    data = res.json()["data"]
    return LearningStyleProfileBase(**data)



def create_personality_quiz(payload: dict, token: str):
    url = f"{ENVS['NEST_API']}/learning/personality-quizzes"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    logging.info(f"[PERSONALITY_QUIZ][POST] {url}")
    logging.debug(f"[PERSONALITY_QUIZ][PAYLOAD] {payload}")

    res = requests.post(url, json=payload, headers=headers, timeout=20)
    res.raise_for_status()

    
    return res.json()

def get_personality_quiz(lesson_id: str, user_id: str, token: str) -> dict:
    url = (
        f"{ENVS['NEST_API']}/learning/personality-quizzes"
        f"?lessonId={lesson_id}&userId={user_id}"
    )
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[PERSONALITY_QUIZ][GET] {url}")

    try:
        res = requests.get(url, headers=headers, timeout=15)
        res.raise_for_status()

        response_json = res.json()
        data_list = response_json.get("data", {}).get("data", [])

        if not data_list:
            logging.warning(f"[PERSONALITY_QUIZ] No quiz found for user {user_id}")
            return None  

        raw_data = data_list[0]
        return raw_data

    except requests.RequestException as e:
        logging.error(f"[PERSONALITY_QUIZ] API Request failed: {e}")
        return None
    except Exception as e:
        logging.error(f"[PERSONALITY_QUIZ] Processing failed: {e}")
        return None
        
def classify_learning_style(description: str | None):
    if not description:
        return None

    text = description.lower()

    if any(k in text for k in ["lihat", "visual", "gambar", "diagram", "video"]):
        return "visual"
    if any(k in text for k in ["dengar", "audio", "penjelasan lisan", "ceramah"]):
        return "auditory"
    if any(k in text for k in ["baca", "menulis", "catatan", "teks"]):
        return "reading_writing"
    if any(k in text for k in ["praktek", "langsung", "contoh nyata", "kinestetik", "kinesthetic"]):
        return "kinesthetic"

    return None


async def build_learning_introduction_llm(
    steps: List[StepBase],
    pipeline,
    learning_style: LearningStyleProfileBase | None = None
):

    if not steps:
        yield "Pengantar pembelajaran akan tersedia setelah langkah materi disusun."
        return

    raw_style = getattr(learning_style, "dominantStyle", None) if learning_style else None
    style = classify_learning_style(raw_style)

    style_map = {
        "visual": (
            "Gunakan penjelasan yang mudah divisualisasikan, pola yang jelas, "
            "struktur langkah yang rapi, serta asosiasi bentuk atau alur."
        ),
        "auditory": (
            "Gunakan aliran bahasa yang runtut seperti percakapan, ritme kalimat yang enak dibaca, "
            "dan penjelasan yang terasa seperti dijelaskan secara lisan."
        ),
        "reading_writing": (
            "Gunakan struktur kalimat informatif, definisi langsung, bullet point, "
            "dan narasi ringkas yang mudah dipindai pembaca."
        ),
        "kinesthetic": (
            "Gunakan contoh nyata, langkah aplikatif, dan konteks praktis yang dapat dibayangkan "
            "sebagai tindakan dunia nyata."
        ),
    }

    style_prompt = style_map.get(
        style,
        "Gunakan gaya netral, jelas, langsung pada inti, dan mudah dipahami."
    )


    # Siapkan step data untuk LLM
    step_data = [{
        "title": s.title,
        "description": s.description or "",
    } for s in steps]

    # Ambil info tambahan dari retrieval untuk memperjelas konteks tiap step
    retrieval_info = []
    for s in steps:
        results = pipeline.retrieve(query=s.title, top_k=5)
        texts = [r["text"] for r in results]
        if texts:
            retrieval_info.append(f"- {s.title}: {' '.join(texts)}")

    retrieval_text = "\n".join(retrieval_info) if retrieval_info else ""

    # Buat prompt akhir untuk LLM
    prompt = f"""
Kamu adalah AI Educator profesional. Tugasmu adalah membuat pengantar pembelajaran
berdasarkan langkah-langkah berikut:

{step_data}

Gunakan informasi retrieval tambahan berikut untuk memperjelas deskripsi:
{retrieval_text}

=== TUJUAN PENGANTAR ===
1. Menjelaskan isi setiap langkah dengan jelas.
2. Menunjukkan nilai atau manfaat praktis dari setiap langkah.
3. Memberikan gambaran alur pembelajaran.
4. Membuat pembelajar tertarik dan termotivasi.
5. Output dalam format Markdown yang komprehensif: gunakan header, bold, bullet, numbering, dan paragraf bebas.

=== GAYA PENULISAN ===
{style_prompt}

=== ATURAN PENULISAN TAMBAHAN ===
- Kalimat aktif dan friendly.
- Beri sedikit sentuhan storytelling agar hidup.
- Hindari jargon berlebihan namun tetap profesional.
- Tidak menyebut AI atau proses teknis.
- Buat alurnya: Hook → Context → Value → Roadmap langkah pembelajaran → Closing Motivation.
- Teks harus enak dibaca saat di-streaming per chunk.
- Sertakan informasi bahwa setelah memahami tiap materi, pembelajar akan selalu di-test dengan quiz yang membantu memperdalam pemahaman.

Instruksi tambahan:
- Hanya gunakan informasi dari steps dan retrieval.
- Mulai dengan sapaan, akhiri dengan call-to-action.
"""

    # Stream hasil LLM
    stream = pipeline.llm.stream(prompt)
    if hasattr(stream, "__aiter__"):
        async for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield text
    else:
        for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield text



def extract_quiz(result):
    quiz = result.get("quiz")
    if isinstance(quiz, list) and len(quiz) > 0 and hasattr(quiz[0], "question"):
        return quiz
    return []