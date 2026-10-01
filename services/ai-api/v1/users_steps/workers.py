from config.celery import celery_app
from v1.users_steps.generate_quiz_pipeline import graph
from v1.users_steps.service import create_personality_quiz

@celery_app.task(
    name="v1.user_steps.generate_personality_quiz",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3
)
def generate_personality_quiz(self, initial_state: dict):
    result = graph.invoke(initial_state)

    quiz_items = result.get("quiz", [])

    questions = [
        {
            "question": q.question,
            "type": q.type,
            "difficulty": q.difficulty,
            "options": q.options,
            "answer": q.answer
        }
        for q in quiz_items
    ]

    create_personality_quiz(
        payload={
            "userId": initial_state["userId"],
            "lessonId": initial_state["lessonId"],
            "title": "AI Generated Personality Quiz",
            "questions": questions,
            "userAttempt": "JSON_NULL",
            "result": "JSON_NULL",
            "takenAt": None
        },
        token=initial_state["token"]
    )


    return questions


