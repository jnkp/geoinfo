"""API routes for administrative operations.

This module provides FastAPI routes for admin operations:
- GET /logs/export: Export logs directory as a zip file

All routes use appropriate HTTP status codes and error handling.
"""

import logging
import os
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from api.schemas import ErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/logs/export",
    response_class=FileResponse,
    summary="Export logs as zip file",
    description="Export all log files from the logs directory as a downloadable zip archive.",
    responses={
        404: {"model": ErrorResponse, "description": "Logs directory not found or empty"},
        500: {"model": ErrorResponse, "description": "Failed to create zip archive"},
    },
)
async def export_logs() -> FileResponse:
    """Export logs directory as a zip file.

    Creates a temporary zip archive containing all files from the ./logs directory
    and returns it as a downloadable file. The temporary file is automatically
    cleaned up after the response is sent.

    Returns:
        FileResponse with the zip file as attachment

    Raises:
        HTTPException: 404 if logs directory doesn't exist or is empty
        HTTPException: 500 if zip creation fails
    """
    logs_dir = Path("./logs")

    # Check if logs directory exists
    if not logs_dir.exists():
        logger.warning("Logs export requested but logs directory does not exist")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Logs directory not found. Debug mode may not be enabled.",
        )

    # Check if there are any files to export
    log_files = list(logs_dir.glob("*"))
    if not log_files:
        logger.warning("Logs export requested but logs directory is empty")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Logs directory is empty. No logs to export.",
        )

    try:
        # Create a temporary file for the zip archive
        # delete=False ensures the file persists until FileResponse sends it
        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=".zip", delete=False
        ) as tmp_file:
            zip_path = tmp_file.name

            # Create zip archive
            with zipfile.ZipFile(tmp_file, "w", zipfile.ZIP_DEFLATED) as zipf:
                for log_file in log_files:
                    if log_file.is_file():
                        # Add file to zip with relative path
                        zipf.write(log_file, arcname=log_file.name)
                        logger.debug(f"Added {log_file.name} to logs archive")

        logger.info(f"Logs archive created successfully with {len(log_files)} files")

        # Create async cleanup function
        async def cleanup():
            await _cleanup_temp_file(zip_path)

        # Return the zip file and schedule cleanup after response is sent
        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename="logs.zip",
            background=cleanup,
        )

    except Exception as e:
        logger.error(f"Failed to create logs archive: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create logs archive: {str(e)}",
        )


async def _cleanup_temp_file(file_path: str):
    """Background task to clean up temporary zip file after response is sent.

    Args:
        file_path: Path to the temporary file to delete
    """
    try:
        os.unlink(file_path)
        logger.debug(f"Cleaned up temporary file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to clean up temporary file {file_path}: {e}")
