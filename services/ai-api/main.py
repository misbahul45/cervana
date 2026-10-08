from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.envs import ENVS
from config.logging_config import configure_logging
from errors.handlers import install_error_handlers
from middleware.trace_id import TraceIdMiddleware
from v1.agents.router_endpoint import router as agents_router
from v1.router import v1Router


configure_logging()
logger = logging.getLogger(__name__)


app = FastAPI(
    title="ReduCera AI Service",
    version="1.0.0",
)


app.add_middleware(TraceIdMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        ENVS["ADMIN_URL"],
        ENVS["WEB_URL"],
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-Trace-Id",
        "x-trace-id",
    ],
)


install_error_handlers(app)


@app.get("/")
async def root():
    return {"title": app.title, "version": app.version, "status": "running"}


@app.get("/ai/")
async def ai_root():
    return {
        "title": app.title,
        "version": app.version,
        "status": "running",
        "v1": "/ai/v1",
    }


app.include_router(v1Router, prefix="/ai")
app.include_router(agents_router, prefix="/ai")



if __name__ == "__main__":
    import uvicorn

    port = ENVS.get("PORT", 8000)
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)