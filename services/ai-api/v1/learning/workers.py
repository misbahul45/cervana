from config.celery import celery_app
from v1.learning.content_pipeline import generate_content_material_pipeline, GenerateContentMaterialPipeline
import logging
from v1.learning.service import create_content_material, update_message_chat, create_message_chat, get_propmpt_material
from config.embedding_pipeline import get_embedding_pipeline

logger = logging.getLogger(__name__)



pipeline=get_embedding_pipeline()

@celery_app.task(
    name="v1.learning.generate_content_material",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3
)
def generate_content_material_task(self, payload: dict):
    try:
        logger.info("📌 Celery Task Triggered: generate_content_material")
        state = GenerateContentMaterialPipeline(**payload)

        result_state = generate_content_material_pipeline(state)

        content_generate = result_state.get("generate")

        create_content_material(content_generate, state.token)

        logger.info("🎉 Content material generation completed successfully!")
        return {
            "message": "Success",
            "data": content_generate
        }

    except Exception as e:
        logger.error(f"❌ Error generating content material: {e}")
        raise e


@celery_app.task(
    name="v1.learning.generate_new_content",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3
)
def generating_new_content(self, payload: dict):
    try:
        logger.info("📌 Celery Task Triggered: generating_new_content")
        chat_id = payload.get("chatId")
        token = payload.get("token")
        query = payload.get("query")
        user_id = payload.get("userId")
        user_step_id = payload.get("userStepId")
        message_id = payload.get("messageId")

        logger.info("🎉 Generating action is tregred!")

        # 2. Nonaktifkan thinking sementara
        pipeline.enable_thinking = False

        # 3. Ambil prompt materi lanjutan
        prompt = get_propmpt_material(query, message_id, user_step_id, user_id, token)

        # 4. Jalankan pipeline untuk generate content berdasarkan prompt
        generated_content = pipeline.llm.invoke(prompt).content.strip()

        # 5. Simpan hasil content
        create_content_material({
            "chatId": chat_id,
            "chatMessageId": message_id,
            "data":generated_content,
            "citatetions": [],  
            "metadata": {
                "userStepId": user_step_id,
                "userId": user_id,
            }   
        }, token)

        # 6. Update message chat dengan konten yang dihasilkan
        update_message_chat(message_id, token, {
            "text": f"Successfully generate continue material for {generated_content:50}",
            "status": "COMPLETED"
        })

        logger.info("🎉 Content material generation completed successfully!")

        return {
            "message": "Success",
            "data": generated_content
        }

    except Exception as e:
        logger.error(f"❌ Error generating new content: {e}")
        raise e
