"""Unit tests for logging configuration and JSON formatting."""

import json
import logging
import os
import tempfile
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pytest

from logging_config import CustomJsonFormatter, request_id_var, setup_logging


# =============================================================================
# Tests
# =============================================================================


def test_json_log_format():
    """Verify log output is valid JSON with required fields."""
    # Create a StringIO to capture log output
    log_stream = StringIO()

    # Create logger with JSON formatter
    logger = logging.getLogger("test_json_logger")
    logger.setLevel(logging.DEBUG)
    logger.handlers.clear()

    # Add handler with CustomJsonFormatter
    handler = logging.StreamHandler(log_stream)
    formatter = CustomJsonFormatter("%(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Set a request_id in context
    test_request_id = "test-request-123"
    request_id_var.set(test_request_id)

    # Log a message
    logger.info("Test message", extra={"custom_field": "custom_value"})

    # Get the logged output
    log_output = log_stream.getvalue().strip()

    # Parse as JSON
    try:
        log_entry = json.loads(log_output)
    except json.JSONDecodeError as e:
        pytest.fail(f"Log output is not valid JSON: {e}\nOutput: {log_output}")

    # Assert: Contains required fields
    assert "timestamp" in log_entry, "Log must contain timestamp"
    assert "level" in log_entry, "Log must contain level"
    assert "logger" in log_entry, "Log must contain logger name"
    assert "message" in log_entry, "Log must contain message"
    assert "request_id" in log_entry, "Log must contain request_id"

    # Assert: Timestamp is ISO 8601 format with Z suffix
    assert log_entry["timestamp"].endswith("Z"), "Timestamp must end with Z"
    assert "T" in log_entry["timestamp"], "Timestamp must be ISO 8601 format"

    # Assert: Other fields have correct values
    assert log_entry["level"] == "INFO"
    assert log_entry["logger"] == "test_json_logger"
    assert log_entry["message"] == "Test message"
    assert log_entry["request_id"] == test_request_id
    assert log_entry["custom_field"] == "custom_value"


def test_log_rotation():
    """Verify logs rotate when exceeding size limit."""
    with tempfile.TemporaryDirectory() as tmpdir:
        log_file = Path(tmpdir) / "test_rotation.log"

        # Create logger with small rotation size for testing
        from logging.handlers import RotatingFileHandler

        logger = logging.getLogger("test_rotation_logger")
        logger.setLevel(logging.DEBUG)
        logger.handlers.clear()

        # Use 1KB rotation size for fast testing
        handler = RotatingFileHandler(
            filename=str(log_file),
            maxBytes=1024,  # 1KB
            backupCount=3,
            encoding="utf-8"
        )
        formatter = CustomJsonFormatter("%(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)

        # Write >1KB of logs (each message ~200 bytes, so 10 messages = ~2KB)
        for i in range(10):
            logger.info(f"Log message {i} with some padding to increase size" * 5)

        # Force flush
        handler.flush()

        # Assert: Main log file exists
        assert log_file.exists(), "Main log file should exist"

        # Assert: Rotation created backup file
        backup_file = Path(f"{log_file}.1")
        assert backup_file.exists(), "Rotation should create .1 backup file"

        # Assert: Main log file is smaller than rotation threshold
        assert log_file.stat().st_size < 1024, "Main log should be smaller than max size after rotation"


def test_debug_mode_disabled():
    """Verify no file logging when DEBUG=false."""
    with tempfile.TemporaryDirectory() as tmpdir:
        log_file = Path(tmpdir) / "app.log"

        # Set DEBUG=false and configure logging
        with patch.dict("os.environ", {
            "DEBUG": "false",
            "LOG_FILE_PATH": str(log_file)
        }):
            # Clear all handlers first
            root_logger = logging.getLogger()
            root_logger.handlers.clear()

            # Call setup_logging
            setup_logging()

            # Log some messages
            test_logger = logging.getLogger("test_no_file_logger")
            test_logger.info("This should not be written to file")
            test_logger.warning("This warning should also not be written to file")

            # Force flush all handlers
            for handler in root_logger.handlers:
                handler.flush()

        # Assert: No log file created
        assert not log_file.exists(), "No log file should be created when DEBUG=false"

        # Assert: Parent directory (./logs) may not exist either
        logs_dir = log_file.parent
        if logs_dir.exists():
            # If it exists, it should be empty
            assert len(list(logs_dir.glob("*.log"))) == 0, "No .log files should exist when DEBUG=false"


def test_logs_directory_creation():
    """Verify ./logs directory is created automatically."""
    with tempfile.TemporaryDirectory() as tmpdir:
        logs_dir = Path(tmpdir) / "logs"
        log_file = logs_dir / "app.log"

        # Ensure logs directory doesn't exist
        assert not logs_dir.exists(), "logs directory should not exist before setup"

        # Set DEBUG=true and configure logging
        with patch.dict("os.environ", {
            "DEBUG": "true",
            "LOG_FILE_PATH": str(log_file),
            "LOG_LEVEL": "INFO"
        }):
            # Clear all handlers first
            root_logger = logging.getLogger()
            root_logger.handlers.clear()

            # Call setup_logging
            setup_logging()

        # Assert: logs directory exists
        assert logs_dir.exists(), "logs directory should be created automatically"

        # Assert: Directory is a directory
        assert logs_dir.is_dir(), "logs should be a directory"

        # Assert: Log file is created
        assert log_file.exists(), "Log file should be created in logs directory"


def test_json_formatter_with_exception():
    """Verify exception information is included in JSON logs."""
    log_stream = StringIO()

    logger = logging.getLogger("test_exception_logger")
    logger.setLevel(logging.ERROR)
    logger.handlers.clear()

    handler = logging.StreamHandler(log_stream)
    formatter = CustomJsonFormatter("%(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Log an exception
    try:
        raise ValueError("Test exception")
    except ValueError:
        logger.error("An error occurred", exc_info=True)

    # Parse log output
    log_output = log_stream.getvalue().strip()
    log_entry = json.loads(log_output)

    # Assert: error field exists
    assert "error" in log_entry, "Log must contain error field for exceptions"

    error = log_entry["error"]
    assert "type" in error, "Error must contain type"
    assert "message" in error, "Error must contain message"
    assert "stack_trace" in error, "Error must contain stack_trace"

    assert error["type"] == "ValueError"
    assert error["message"] == "Test exception"
    assert "ValueError: Test exception" in error["stack_trace"]
