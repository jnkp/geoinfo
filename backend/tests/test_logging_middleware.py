"""Unit tests for request/response logging middleware."""

import json
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport

from middleware.logging import LoggingMiddleware, redact_sensitive_headers, request_id_var


# =============================================================================
# Test App Setup
# =============================================================================


def create_test_app_with_logging():
    """Create a test FastAPI app with logging middleware."""
    app = FastAPI()

    # Add logging middleware
    app.add_middleware(LoggingMiddleware, slow_threshold_ms=1000)

    # Add test routes
    @app.get("/test")
    async def test_route():
        return {"message": "test"}

    @app.get("/test-request-id")
    async def test_request_id_route():
        # Return the current request_id from context
        return {"request_id": request_id_var.get("")}

    @app.post("/test-post")
    async def test_post_route(data: dict):
        return {"received": data}

    return app


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.asyncio
async def test_request_id_generation():
    """Verify each request generates unique UUID-format request_id."""
    app = create_test_app_with_logging()

    # Make 10 requests and collect request_ids from response headers
    request_ids = []

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        for _ in range(10):
            response = await client.get("/test")
            assert response.status_code == 200

            # Extract request_id from response header
            request_id = response.headers.get("X-Request-ID")
            assert request_id is not None, "X-Request-ID header must be present"

            # Verify UUID format
            try:
                uuid_obj = uuid.UUID(request_id)
                assert str(uuid_obj) == request_id, "request_id must be valid UUID"
            except ValueError:
                pytest.fail(f"request_id '{request_id}' is not a valid UUID")

            request_ids.append(request_id)

    # Assert: All 10 are unique
    assert len(request_ids) == 10, "Should have collected 10 request_ids"
    assert len(set(request_ids)) == 10, "All request_ids must be unique"


@pytest.mark.asyncio
async def test_request_logging():
    """Verify request details are logged correctly."""
    app = create_test_app_with_logging()

    with patch("middleware.logging.logger") as mock_logger:
        # Set DEBUG=true for this test
        with patch.dict("os.environ", {"DEBUG": "true"}):
            # Reload the module to pick up DEBUG=true
            import importlib
            import middleware.logging as logging_module

            importlib.reload(logging_module)

            # Create new app with reloaded middleware
            app = create_test_app_with_logging()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Make GET request with query params and headers
                response = await client.get(
                    "/test?param1=value1&param2=value2",
                    headers={"X-Custom-Header": "test-value"},
                )
                assert response.status_code == 200

            # Verify logging was called
            assert mock_logger.info.called, "Logger should be called for requests"

            # Find the request log entry
            request_log_found = False
            for call in mock_logger.info.call_args_list:
                if len(call.args) > 0 and "GET /test" in call.args[0]:
                    extra = call.kwargs.get("extra", {})
                    request_data = extra.get("request", {})

                    # Assert: Log entry contains method, path, params, headers
                    assert request_data.get("method") == "GET"
                    assert request_data.get("path") == "/test"
                    assert "param1" in request_data.get("query_params", {})
                    assert request_data.get("query_params", {}).get("param1") == "value1"
                    assert "headers" in request_data

                    # Assert: request_id present in extra
                    request_id = response.headers.get("X-Request-ID")
                    assert request_id is not None

                    request_log_found = True
                    break

            assert request_log_found, "Request log entry should be created"


@pytest.mark.asyncio
async def test_response_logging():
    """Verify response details are logged correctly."""
    app = create_test_app_with_logging()

    with patch("middleware.logging.logger") as mock_logger:
        # Set DEBUG=true for this test
        with patch.dict("os.environ", {"DEBUG": "true"}):
            # Reload the module to pick up DEBUG=true
            import importlib
            import middleware.logging as logging_module

            importlib.reload(logging_module)

            # Create new app with reloaded middleware
            app = create_test_app_with_logging()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/test")
                assert response.status_code == 200
                request_id = response.headers.get("X-Request-ID")

            # Verify logging was called
            assert mock_logger.log.called or mock_logger.info.called

            # Find the response log entry
            response_log_found = False
            for call in (
                mock_logger.log.call_args_list + mock_logger.info.call_args_list
            ):
                extra = call.kwargs.get("extra", {})
                response_data = extra.get("response", {})

                if response_data:
                    # Assert: Log entry contains status code, duration_ms
                    assert "status_code" in response_data
                    assert response_data["status_code"] == 200
                    assert "duration_ms" in response_data
                    assert isinstance(response_data["duration_ms"], (int, float))
                    assert response_data["duration_ms"] >= 0

                    response_log_found = True
                    break

            assert response_log_found, "Response log entry should be created"


@pytest.mark.asyncio
async def test_request_id_propagation():
    """Verify request_id propagates through entire request lifecycle."""
    app = create_test_app_with_logging()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Make request that accesses request_id from context
        response = await client.get("/test-request-id")
        assert response.status_code == 200

        # Get request_id from header
        header_request_id = response.headers.get("X-Request-ID")
        assert header_request_id is not None

        # Get request_id from response body (from context variable)
        body_request_id = response.json()["request_id"]

        # Assert: request_id in context matches header
        assert (
            body_request_id == header_request_id
        ), "request_id in context must match header"


def test_redact_sensitive_headers():
    """Verify sensitive headers are redacted."""
    headers = {
        "Authorization": "Bearer secret-token",
        "Cookie": "session=abc123",
        "X-API-Key": "secret-key",
        "Content-Type": "application/json",
        "X-Custom": "safe-value",
    }

    redacted = redact_sensitive_headers(headers)

    # Sensitive headers should be redacted
    assert redacted["Authorization"] == "***"
    assert redacted["Cookie"] == "***"
    assert redacted["X-API-Key"] == "***"

    # Non-sensitive headers should remain
    assert redacted["Content-Type"] == "application/json"
    assert redacted["X-Custom"] == "safe-value"
