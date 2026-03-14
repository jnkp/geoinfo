"""Logging configuration with structured JSON output and DEBUG-gated file rotation."""

import logging
import os
from contextvars import ContextVar
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from pythonjsonlogger import jsonlogger

# Context variable for request ID propagation (async-safe)
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with standardized fields and request_id."""

    def add_fields(self, log_record, record, message_dict):
        """Add custom fields to the log record.

        Args:
            log_record: The dictionary that will be JSON-serialized
            record: The LogRecord object
            message_dict: Dictionary of message parameters
        """
        super().add_fields(log_record, record, message_dict)

        # Add timestamp in ISO 8601 format with Z suffix
        log_record["timestamp"] = datetime.utcnow().isoformat() + "Z"

        # Add level and logger name
        log_record["level"] = record.levelname
        log_record["logger"] = record.name

        # Add request_id from context variable
        log_record["request_id"] = request_id_var.get("")

        # Add error information if present
        if record.exc_info:
            log_record["error"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stack_trace": self.formatException(record.exc_info),
            }


def setup_logging() -> None:
    """Configure logging with structured JSON output and file rotation.

    Only activates file logging when DEBUG environment variable is set to 'true'.
    Creates ./logs directory if it doesn't exist.
    Uses RotatingFileHandler with 100MB max size and 7-day retention.
    """
    # Read configuration from environment
    debug = os.getenv("DEBUG", "false").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "json" if debug else "text")
    log_file_path = os.getenv("LOG_FILE_PATH", "./logs/app.log")

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # Console handler with simple format (always active)
    console_handler = logging.StreamHandler()
    if log_format == "json":
        console_formatter = CustomJsonFormatter(
            "%(timestamp)s %(level)s %(name)s %(message)s"
        )
    else:
        console_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # File handler with rotation (only when DEBUG=true)
    if debug:
        # Create logs directory if it doesn't exist
        log_dir = Path(log_file_path).parent
        log_dir.mkdir(parents=True, exist_ok=True)

        # Rotating file handler: 100MB max, 7 backups (7-day retention)
        file_handler = RotatingFileHandler(
            filename=log_file_path,
            maxBytes=100 * 1024 * 1024,  # 100MB
            backupCount=7,
            encoding="utf-8",
        )

        # Always use JSON formatter for file logs in debug mode
        file_formatter = CustomJsonFormatter(
            "%(timestamp)s %(level)s %(name)s %(message)s"
        )
        file_handler.setFormatter(file_formatter)
        file_handler.setLevel(log_level)
        root_logger.addHandler(file_handler)

        root_logger.info(
            "Logging initialized",
            extra={
                "debug": debug,
                "log_level": log_level,
                "log_format": log_format,
                "log_file": log_file_path,
            },
        )
    else:
        root_logger.info(
            "Logging initialized (file logging disabled)",
            extra={"debug": debug, "log_level": log_level},
        )
