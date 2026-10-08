from __future__ import annotations


class AIServiceError(Exception):
    code = "AI_SERVICE_ERROR"
    http_status = 500

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class LLMError(AIServiceError):
    code = "LLM_ERROR"
    http_status = 502


class RetrievalError(AIServiceError):
    code = "RETRIEVAL_ERROR"
    http_status = 502


class MemoryError(AIServiceError):
    code = "MEMORY_ERROR"
    http_status = 502


class CrossServiceError(AIServiceError):
    code = "CROSS_SERVICE_ERROR"
    http_status = 502


class TimeoutError_(AIServiceError):
    code = "TIMEOUT"
    http_status = 504


TimeoutError = TimeoutError_


class SchemaValidationError(AIServiceError):
    code = "SCHEMA_VALIDATION_ERROR"
    http_status = 500


class AuthError(AIServiceError):
    code = "AUTH_ERROR"
    http_status = 401


__all__ = [
    "AIServiceError",
    "LLMError",
    "RetrievalError",
    "MemoryError",
    "CrossServiceError",
    "TimeoutError",
    "SchemaValidationError",
    "AuthError",
]