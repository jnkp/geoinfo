"""Unit tests for admin API endpoints."""

import json
import tempfile
import zipfile
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport

from api.admin import router


# =============================================================================
# Test App Setup
# =============================================================================


def create_test_app():
    """Create a test FastAPI app with admin router."""
    app = FastAPI()
    app.include_router(router, prefix="/api/admin")
    return app


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.asyncio
async def test_log_export():
    """Verify export endpoint returns valid zip containing log files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create some test log files
        logs_dir = Path(tmpdir) / "logs"
        logs_dir.mkdir()

        # Create sample log files with valid JSON content
        log1 = logs_dir / "app.log"
        log1.write_text(
            json.dumps({"timestamp": "2024-01-01T00:00:00Z", "message": "Log 1"}) + "\n"
        )

        log2 = logs_dir / "app.log.1"
        log2.write_text(
            json.dumps({"timestamp": "2024-01-01T01:00:00Z", "message": "Log 2"}) + "\n"
        )

        # Temporarily change the logs directory path
        import api.admin as admin_module
        from unittest.mock import patch

        app = create_test_app()

        # Mock Path("./logs") to point to our temp directory
        with patch.object(admin_module.Path, '__new__', return_value=logs_dir):
            # Actually, we need a better approach - let's mock the actual Path constructor call
            original_path = admin_module.Path

            def mock_path(path_str):
                if path_str == "./logs":
                    return logs_dir
                return original_path(path_str)

            with patch.object(admin_module, 'Path', side_effect=mock_path):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.get("/api/admin/logs/export")

                    # Assert: Status 200
                    assert response.status_code == 200, "Export should return 200 OK"

                    # Assert: Content-Type is application/zip
                    assert response.headers["content-type"] == "application/zip"

                    # Assert: Response body is valid zip file
                    # Write response to temp file and verify
                    zip_path = Path(tmpdir) / "downloaded.zip"
                    zip_path.write_bytes(response.content)

                    assert zipfile.is_zipfile(zip_path), "Response must be a valid zip file"

                    # Assert: Zip contains log files
                    with zipfile.ZipFile(zip_path, 'r') as zipf:
                        file_list = zipf.namelist()
                        assert len(file_list) == 2, "Zip should contain 2 files"
                        assert "app.log" in file_list
                        assert "app.log.1" in file_list

                        # Assert: Log files contain valid JSON
                        log1_content = zipf.read("app.log").decode("utf-8")
                        log1_data = json.loads(log1_content.strip())
                        assert log1_data["message"] == "Log 1"

                        log2_content = zipf.read("app.log.1").decode("utf-8")
                        log2_data = json.loads(log2_content.strip())
                        assert log2_data["message"] == "Log 2"


@pytest.mark.asyncio
async def test_log_export_empty():
    """Verify 404 when no logs exist."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create empty logs directory
        logs_dir = Path(tmpdir) / "logs"
        logs_dir.mkdir()

        import api.admin as admin_module

        app = create_test_app()

        # Mock Path to point to empty logs directory
        original_path = admin_module.Path

        def mock_path(path_str):
            if path_str == "./logs":
                return logs_dir
            return original_path(path_str)

        from unittest.mock import patch

        with patch.object(admin_module, 'Path', side_effect=mock_path):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/admin/logs/export")

                # Assert: Status 404
                assert response.status_code == 404, "Empty logs should return 404"

                # Assert: Error message indicates no logs found
                error_data = response.json()
                assert "detail" in error_data
                assert "empty" in error_data["detail"].lower()


@pytest.mark.asyncio
async def test_log_export_directory_not_exists():
    """Verify 404 when logs directory doesn't exist."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Don't create logs directory - it doesn't exist
        logs_dir = Path(tmpdir) / "logs"

        import api.admin as admin_module

        app = create_test_app()

        # Mock Path to point to non-existent logs directory
        original_path = admin_module.Path

        def mock_path(path_str):
            if path_str == "./logs":
                return logs_dir
            return original_path(path_str)

        from unittest.mock import patch

        with patch.object(admin_module, 'Path', side_effect=mock_path):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/admin/logs/export")

                # Assert: Status 404
                assert response.status_code == 404

                # Assert: Error message indicates logs not found
                error_data = response.json()
                assert "detail" in error_data
                assert "not found" in error_data["detail"].lower()


@pytest.mark.asyncio
async def test_log_export_zip_structure():
    """Verify zip file structure and content validity."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create logs directory with multiple files
        logs_dir = Path(tmpdir) / "logs"
        logs_dir.mkdir()

        # Create various log files
        log_files = ["app.log", "app.log.1", "app.log.2"]
        for i, filename in enumerate(log_files):
            log_file = logs_dir / filename
            # Write multiple JSON log entries
            entries = [
                json.dumps({
                    "timestamp": f"2024-01-01T0{i}:00:00Z",
                    "level": "INFO",
                    "message": f"Log entry {j} from {filename}"
                })
                for j in range(3)
            ]
            log_file.write_text("\n".join(entries) + "\n")

        import api.admin as admin_module

        app = create_test_app()

        # Mock Path to point to our temp logs directory
        original_path = admin_module.Path

        def mock_path(path_str):
            if path_str == "./logs":
                return logs_dir
            return original_path(path_str)

        from unittest.mock import patch

        with patch.object(admin_module, 'Path', side_effect=mock_path):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/admin/logs/export")

                assert response.status_code == 200

                # Extract and verify zip
                zip_path = Path(tmpdir) / "export.zip"
                zip_path.write_bytes(response.content)

                with zipfile.ZipFile(zip_path, 'r') as zipf:
                    # Assert: All files from logs directory are in zip
                    zip_files = set(zipf.namelist())
                    expected_files = set(log_files)
                    assert zip_files == expected_files, "Zip should contain all log files"

                    # Assert: Each log file is valid JSON (line-delimited)
                    for log_file in log_files:
                        content = zipf.read(log_file).decode("utf-8")
                        lines = content.strip().split("\n")

                        # Each line should be valid JSON
                        for line in lines:
                            log_entry = json.loads(line)
                            assert "timestamp" in log_entry
                            assert "level" in log_entry
                            assert "message" in log_entry
