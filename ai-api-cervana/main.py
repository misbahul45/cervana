from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from config.envs import ENVS
from v1.router import v1Router
from fastapi.middleware.cors import CORSMiddleware
import logging
import subprocess

logger = logging.getLogger("uvicorn")

app = FastAPI(
    title="Cervana AI Service",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        ENVS['ADMIN_URL'],
        ENVS['WEB_URL']
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def start_celery_worker():
    global worker_process
    worker_process = subprocess.Popen(
        ["celery", "-A", "config.celery:celery_app", "worker", "--loglevel=info"]
    )
    print("Celery worker started in background.")

@app.on_event("shutdown")
def stop_celery_worker():
    global worker_process
    if worker_process:
        worker_process.terminate()
        print("Celery worker stopped.")

@app.exception_handler(404)
async def not_found_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={"message": "Not Found", "detail": f"The requested resource was not found at {request.url.path}"},
    )

@app.get("/")
async def root():
    return {"title": app.title, "version": app.version, "status": "running"}

app.include_router(v1Router, prefix='/ai')

if __name__ == "__main__":
    import uvicorn
    port = ENVS.get("PORT", 8000)
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

    