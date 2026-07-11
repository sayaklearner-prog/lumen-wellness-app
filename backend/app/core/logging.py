import sys
import uuid
from loguru import logger
from contextvars import ContextVar
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Context variables for tracing
request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default=None)
user_id_ctx_var: ContextVar[str] = ContextVar("user_id", default=None)

def setup_logging(log_level: str = "INFO"):
    logger.remove()
    logger.add(
        sys.stdout,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message} | {extra}",
        level=log_level,
        enqueue=True,
    )
    # Configure logger to inject context variables
    logger.configure(patcher=lambda record: record["extra"].update({
        "request_id": request_id_ctx_var.get(),
        "user_id": user_id_ctx_var.get(),
    }))

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        token1 = request_id_ctx_var.set(request_id)
        
        # User ID would be set later by auth middleware, but we can initialize it here
        token2 = user_id_ctx_var.set(None)

        try:
            logger.info(f"Request started: {request.method} {request.url.path}")
            response = await call_next(request)
            logger.info(f"Request completed: {request.method} {request.url.path} - Status: {response.status_code}")
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            request_id_ctx_var.reset(token1)
            user_id_ctx_var.reset(token2)
