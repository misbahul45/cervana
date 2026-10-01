from config.envs import ENVS
import logging
import requests
from urllib.parse import urlencode
from typing import Any
from v1.learning.dto import LessonBase, UserStepBase
from config.embedding_pipeline import get_embedding_pipeline
from utils.tools.memory import tool_memory_upsert, tool_semantic_search, memory_manager
from utils.tools.web_search import tool_web_search

pipeline=get_embedding_pipeline()

def update_message_chat(messageId:str, token:str, payload:dict):
    url = f"{ENVS['NEST_API']}/chat/chat-messages/{messageId}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[ChatMessage] [PATCH] {url}")
    
    res = requests.patch(url, json=payload, headers=headers, timeout=15)
    res.raise_for_status()
    data = res.json()["data"]
    return data

def create_message_chat(payload: dict, token: str) -> Any:
    url = f"{ENVS['NEST_API']}/chat/chat-messages"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[ChatMessage] [CREATE] {url}")   
    res = requests.post(url, json=payload, headers=headers, timeout=15)
    res.raise_for_status()
    data = res.json()["data"]
    return data

def query_content_history(chatId: str, q: str, token: str) -> Any:
    base_url = f"{ENVS['NEST_API']}/chat/contents/similarity"

    params = {
        "chatId": chatId,
        "query": q
    }
    query_string = urlencode(params)
    url = f"{base_url}?{query_string}"

    headers = {"Authorization": f"Bearer {token}"}

    logging.info(f"[ContentHistory][QUERY] {url}")
    
    res = requests.get(url, headers=headers, timeout=15)
    
    res.raise_for_status()
    
    data = res.json()["data"]['data']
    return data


def get_lesson(lessonId: str, token: str) -> LessonBase:
    url = f"{ENVS['NEST_API']}/curriculum/lessons/{lessonId}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[LESSON][GET ONE] {url}")

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()

    data = res.json()["data"]
    return LessonBase(**data)

def get_user_step(userStepId: str, token: str) -> UserStepBase:
    url = f"{ENVS['NEST_API']}/learning/user-steps/{userStepId}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[USER_STEP][GET ONE] {url}")

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()

    data = res.json()["data"]
    return data



def create_content_material(payload: dict, token: str) -> Any:
    url = f"{ENVS['NEST_API']}/chat/contents"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[CONTENT_MATERIAL][CREATE] {url}")
    res = requests.post(url, json=payload, headers=headers, timeout=15)
    res.raise_for_status()
    data = res.json()["data"]
    return data


def get_propmpt_material(query: str, message_id: str, user_step_id: str, user_id: str, token: str) -> str:
    # 1. Ambil RAG materials
    update_message_chat(message_id, token, {
        "text": f"Retrieved RAG materials for query: {query}",
        "status": "PROCESSING"
    })
    rag_results = pipeline.retrieve(query=query, metadata_filter={"source": "material"}, top_k=10)
    rag = "\n".join([r["text"] for r in rag_results]) if rag_results else ""

    # 2. Ambil web search results
    update_message_chat(message_id, token, {
        "text": f"Performing web search for query: {query}",
        "status": "PROCESSING"
    })
    web = tool_web_search(query, limit=10)

    # 3. Ambil user step info
    user_step = get_user_step(user_step_id, token)
    print(user_step)
    user_step_title = user_step['title']

    # 4. Ambil memory pengguna
    update_message_chat(message_id, token, {
        "text": f"Analysing user memory related to learning goal: {user_step_title}",
        "status": "PROCESSING"
    })
    memory = memory_manager.retrieve_as_string(
        user_id=user_id,
        top_k=10,
        memory_type="query"
    )

    # 5. Buat prompt materi lanjutan
    update_message_chat(message_id, token, {
        "text": f"Structuring continuation of learning material...",
        "status": "PROCESSING"
    })

    prompt = f"""
You are an expert AI Learning Assistant. The user has a learning goal: "{user_step_title}".
Your task is to **continue and deepen the educational material** based on the user's question: "{query}".

**Out-of-Context Handling:**
If the user's question is outside the scope of the learning goal or unrelated to the current learning context, respond with:
"Maaf, saya belum bisa menjawab itu karena pertanyaannya di luar konteks pembelajaran saat ini."

**Guidelines for Generating the Material:**
1. **Continuation & Deepening:** Extend the existing material by elaborating concepts, adding examples, or clarifying details based on the user's query.
2. **Integrate Multiple Sources:** Use RAG materials and web search results to provide comprehensive and accurate explanations. Combine them smoothly into the content.
3. **Leverage User Memory:** Take into account what the user already knows or has asked before. Start with quick reminders if needed, then progress to deeper insights.
4. **Structure of Output Material:** 
   - Begin with a brief review of relevant concepts (if memory indicates prior knowledge).
   - Explain key points and concepts related to the query.
   - Include practical examples, analogies, and clarifications.
   - Conclude with a brief summary or insight.
5. **Tone & Clarity:** Keep the language educational, clear, concise, and easy to understand.
6. **Important:** Only output the **learning material**. Do not include instructions, metadata, sources, or any prompt notes in the final output.

**Reference Data (Do not output):**
RAG Materials:
{rag if rag else '[No RAG materials available]'}
Web Search Results:
{web if web else '[No web results available]'}
User Memory:
{memory if memory else '[No user memory available]'}
"""

    return prompt
