"""Request/response logging middleware with performance tracking.

This module provides:
- Unique request_id generation and context propagation
- Request/response logging with structured data
- Performance metrics (duration tracking)
- Slow request detection (>1s warning, >5s error)
- Sensitive header redaction

Only active when DEBUG=true to ensure zero performance overhead in production.
"""

import json
import logging
import os
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from logging_config import request_id_var

# Module logger
logger = logging.getLogger(__name__)

# Check if DEBUG mode is enabled
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Sensitive headers to redact from logs
SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
    "proxy-authorization",
}


def redact_sensitive_headers(headers: dict) -> dict:
    """Redact sensitive header values for safe logging.

    Args:
        headers: Dictionary of HTTP headers

    Returns:
        Dictionary with sensitive values replaced by '***'
    """
    redacted = {}
    for key, value in headers.items():
        if key.lower() in SENSITIVE_HEADERS:
            redacted[key] = "***"
        else:
            redacted[key] = value
    return redacted


async def get_request_body(request: Request) -> str | None:
    """Safely extract request body for logging (POST/PUT/PATCH only).

    Args:
        request: The incoming request

    Returns:
        Request body as string, or None if not applicable/readable
    """
    # Only log bodies for methods that typically have them
    if request.method not in ["POST", "PUT", "PATCH"]:
        return None

    try:
        # Read body bytes (this consumes the stream)
        body_bytes = await request.body()

        # Try to decode as JSON for structured logging
        if body_bytes:
            try:
                body_json = json.loads(body_bytes)
                # Redact sensitive fields if present
                if isinstance(body_json, dict):
                    for sensitive_field in ["password", "token", "secret", "api_key"]:
                        if sensitive_field in body_json:
                            body_json[sensitive_field] = "***"
                return json.dumps(body_json)
            except (json.JSONDecodeError, UnicodeDecodeError):
                # If not JSON, return truncated string representation
                return body_bytes.decode("utf-8", errors="replace")[:1000]
        return None
    except Exception as e:
        logger.warning(f"Failed to read request body: {e}")
        return None


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for request/response logging with performance tracking.

    Features:
    - Generates unique request_id for each request
    - Logs request details (method, path, params, headers)
    - Tracks request duration using high-resolution timer
    - Logs response details (status, size, duration)
    - Warns on slow requests (>1s) and errors on very slow (>5s)
    - Only active when DEBUG=true
    """

    def __init__(self, app: ASGIApp, slow_threshold_ms: int = 1000):
        """Initialize the logging middleware.

        Args:
            app: The ASGI application
            slow_threshold_ms: Threshold in milliseconds for slow request warning
        """
        super().__init__(app)
        self.slow_threshold_ms = slow_threshold_ms
        self.error_threshold_ms = 5000  # 5 seconds

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and response with logging and performance tracking.

        Args:
            request: The incoming request
            call_next: Function to call the next middleware/handler

        Returns:
            Response with X-Request-ID header
        """
        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Set request_id in context variable for propagation
        request_id_var.set(request_id)

        # Store in request state for handler access
        request.state.request_id = request_id

        # Start performance timer
        start_time = time.perf_counter()

        # Log request details (only when DEBUG=true)
        if DEBUG:
            # Build request log data
            request_data = {
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "headers": redact_sensitive_headers(dict(request.headers)),
                "client": {
                    "host": request.client.host if request.client else None,
                    "port": request.client.port if request.client else None,
                },
            }

            # Add body for POST/PUT/PATCH requests
            if request.method in ["POST", "PUT", "PATCH"]:
                # Note: This consumes the request body stream, so we need to
                # store it for the actual handler to use
                body = await get_request_body(request)
                if body:
                    request_data["body"] = body

            logger.info(
                f"{request.method} {request.url.path}",
                extra={"request": request_data, "event": "request_started"},
            )

        # Process request
        try:
            response = await call_next(request)
        except Exception as exc:
            # Log exception and re-raise
            duration_ms = (time.perf_counter() - start_time) * 1000
            if DEBUG:
                logger.error(
                    f"Request failed: {type(exc).__name__}: {exc}",
                    extra={
                        "event": "request_failed",
                        "duration_ms": duration_ms,
                        "error": {
                            "type": type(exc).__name__,
                            "message": str(exc),
                        },
                    },
                    exc_info=True,
                )
            raise

        # Calculate request duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Add request_id to response headers
        response.headers["X-Request-ID"] = request_id

        # Log response details (only when DEBUG=true)
        if DEBUG:
            # Get response size if available
            response_size = None
            if hasattr(response, "body"):
                try:
                    response_size = len(response.body)
                except (TypeError, AttributeError):
                    pass

            response_data = {
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "response_size_bytes": response_size,
            }

            # Determine log level based on duration thresholds
            log_level = logging.INFO
            log_message = f"{request.method} {request.url.path} - {response.status_code}"

            if duration_ms > self.error_threshold_ms:
                log_level = logging.ERROR
                log_message = f"VERY SLOW REQUEST: {log_message} ({duration_ms:.0f}ms)"
                response_data["slow_request"] = True
                response_data["threshold"] = "error"
            elif duration_ms > self.slow_threshold_ms:
                log_level = logging.WARNING
                log_message = f"SLOW REQUEST: {log_message} ({duration_ms:.0f}ms)"
                response_data["slow_request"] = True
                response_data["threshold"] = "warning"

            logger.log(
                log_level,
                log_message,
                extra={"response": response_data, "event": "request_completed"},
            )

        return response
