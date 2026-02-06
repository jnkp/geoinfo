"""Background worker for scheduled data fetching using APScheduler.

This module provides the background worker service that schedules and executes
automated data fetching jobs from the StatFin API.

The worker:
- Uses APScheduler for job scheduling with asyncio support
- Runs fetch jobs based on FetchConfig configurations
- Tracks fetch status in the database via FetchConfig model
- Handles graceful shutdown and error recovery
- Provides comprehensive logging for all job executions and errors

Status Tracking:
- FetchConfig.last_fetch_status: "pending", "success", or "failed"
- FetchConfig.last_fetch_at: Timestamp of last successful fetch
- FetchConfig.last_error_message: Error details for failed fetches
- FetchConfig.fetch_count: Total number of successful fetches
- FetchConfig.next_fetch_at: Scheduled time for next fetch attempt

Usage:
    # Run the worker directly:
    python worker.py

    # Or import and use programmatically:
    from worker import scheduler, start_worker, stop_worker
"""

import asyncio
import logging
import signal
import sys
import traceback
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, JobExecutionEvent

from config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler = AsyncIOScheduler(
    timezone="UTC",
    job_defaults={
        "coalesce": True,  # Combine multiple missed executions into one
        "max_instances": 1,  # Only one instance of each job at a time
        "misfire_grace_time": 3600,  # Allow jobs to run up to 1 hour late
    },
)


def job_listener(event: JobExecutionEvent) -> None:
    """Listen for job execution events and log results.

    This listener captures all job execution events and logs them with
    appropriate severity. For failed jobs, full exception details including
    traceback are logged for debugging purposes.

    Args:
        event: The job execution event from APScheduler
    """
    job_id = event.job_id
    scheduled_run_time = event.scheduled_run_time

    if event.exception:
        # Log full exception details for debugging
        exc_info = (
            type(event.exception),
            event.exception,
            event.exception.__traceback__,
        )
        logger.error(
            "Job %s failed at %s with exception: %s",
            job_id,
            scheduled_run_time,
            event.exception,
            exc_info=exc_info,
        )
        # Also log a summary for easy monitoring
        logger.error(
            "FETCH_JOB_ERROR: job_id=%s, scheduled_time=%s, error_type=%s, error_message=%s",
            job_id,
            scheduled_run_time.isoformat() if scheduled_run_time else "N/A",
            type(event.exception).__name__,
            str(event.exception),
        )
    else:
        # Log success with structured format for monitoring
        retval = event.retval or {}
        logger.info(
            "Job %s executed successfully at %s",
            job_id,
            scheduled_run_time,
        )
        if isinstance(retval, dict):
            logger.info(
                "FETCH_JOB_SUCCESS: job_id=%s, datasets_attempted=%d, "
                "datasets_successful=%d, datasets_failed=%d, records_inserted=%d",
                job_id,
                retval.get("datasets_attempted", 0),
                retval.get("datasets_successful", 0),
                retval.get("datasets_failed", 0),
                retval.get("total_records_inserted", 0),
            )


# Add listener for job events
scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)


async def initialize_database() -> None:
    """Initialize database connection and run any pending migrations.

    Ensures the database is ready before starting scheduled jobs.
    """
    from models.database import engine, Base

    logger.info("Initializing database connection...")

    try:
        async with engine.begin() as conn:
            # Create tables if they don't exist (for development)
            # In production, use Alembic migrations instead
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database initialization complete")

    except Exception as e:
        logger.error("Failed to initialize database: %s", e)
        raise


def setup_jobs() -> None:
    """Set up scheduled jobs based on configuration.

    This function adds the main fetch job to the scheduler with the
    interval specified in the application settings.
    """
    settings = get_settings()

    # Add the main fetch job
    scheduler.add_job(
        run_fetch_job,
        trigger=IntervalTrigger(hours=settings.fetch_interval_hours),
        id="main_fetch_job",
        name="Main Data Fetch Job",
        replace_existing=True,
        next_run_time=datetime.utcnow(),  # Run immediately on startup
    )

    logger.info(
        "Scheduled main fetch job to run every %d hours",
        settings.fetch_interval_hours,
    )


async def run_fetch_job() -> dict:
    """Execute the main data fetch job.

    This is the primary job function that fetches data for all active
    configurations from the StatFin API.

    Status Tracking:
        The DataFetcher automatically updates FetchConfig records with:
        - last_fetch_status: "success" or "failed"
        - last_fetch_at: Timestamp of successful fetch
        - last_error_message: Details if fetch failed
        - fetch_count: Incremented on success
        - next_fetch_at: Scheduled for next interval

    Returns:
        Dict with summary of fetch results including:
        - started_at/completed_at: Job execution timestamps
        - datasets_attempted/successful/failed: Counts
        - total_records_inserted: Sum of inserted records
        - errors: List of error details per failed dataset
    """
    from services.fetcher import DataFetcher

    job_start_time = datetime.utcnow()
    logger.info(
        "FETCH_JOB_START: Starting scheduled fetch job at %s",
        job_start_time.isoformat(),
    )

    results_summary = {
        "started_at": job_start_time.isoformat(),
        "datasets_attempted": 0,
        "datasets_successful": 0,
        "datasets_failed": 0,
        "total_records_inserted": 0,
        "total_records_updated": 0,
        "errors": [],
    }

    try:
        async with DataFetcher() as fetcher:
            results = await fetcher.fetch_all_active()

            for result in results:
                results_summary["datasets_attempted"] += 1

                if result.success:
                    results_summary["datasets_successful"] += 1
                    results_summary["total_records_inserted"] += result.records_inserted
                    results_summary["total_records_updated"] += result.records_updated

                    # Log individual dataset success
                    logger.info(
                        "FETCH_DATASET_SUCCESS: dataset_id=%s, records_inserted=%d, "
                        "records_updated=%d, duration=%.2fs",
                        result.dataset_id,
                        result.records_inserted,
                        result.records_updated,
                        result.duration_seconds,
                    )
                else:
                    results_summary["datasets_failed"] += 1
                    error_entry = {
                        "dataset_id": result.dataset_id,
                        "error": result.error_message,
                        "duration_seconds": result.duration_seconds,
                    }
                    results_summary["errors"].append(error_entry)

                    # Log individual dataset failure with full details
                    logger.error(
                        "FETCH_DATASET_FAILED: dataset_id=%s, error=%s, duration=%.2fs",
                        result.dataset_id,
                        result.error_message,
                        result.duration_seconds,
                    )

    except Exception as e:
        # Log full traceback for job-level errors
        logger.error(
            "FETCH_JOB_CRITICAL_ERROR: Job execution failed with %s: %s\n%s",
            type(e).__name__,
            str(e),
            traceback.format_exc(),
        )
        results_summary["errors"].append({
            "dataset_id": "job_execution",
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc(),
        })

    job_end_time = datetime.utcnow()
    results_summary["completed_at"] = job_end_time.isoformat()
    results_summary["duration_seconds"] = (job_end_time - job_start_time).total_seconds()

    # Log comprehensive job summary
    logger.info(
        "FETCH_JOB_COMPLETE: attempted=%d, successful=%d, failed=%d, "
        "records_inserted=%d, records_updated=%d, duration=%.2fs",
        results_summary["datasets_attempted"],
        results_summary["datasets_successful"],
        results_summary["datasets_failed"],
        results_summary["total_records_inserted"],
        results_summary["total_records_updated"],
        results_summary["duration_seconds"],
    )

    # Log error summary if there were failures
    if results_summary["datasets_failed"] > 0:
        logger.warning(
            "FETCH_JOB_ERRORS: %d dataset(s) failed during this run",
            results_summary["datasets_failed"],
        )
        for error in results_summary["errors"]:
            logger.warning(
                "  - Dataset %s: %s",
                error.get("dataset_id", "unknown"),
                error.get("error", "unknown error"),
            )

    return results_summary


async def trigger_fetch_now(dataset_id: Optional[str] = None) -> dict:
    """Manually trigger a fetch job outside the schedule.

    This function allows triggering data fetches on-demand, outside the
    regular schedule. Status tracking in FetchConfig is updated the same
    way as scheduled fetches.

    Args:
        dataset_id: Optional specific dataset to fetch. If None, fetches all active.

    Returns:
        Dict with fetch results including:
        - success: Whether the fetch(es) succeeded
        - dataset_id/datasets_fetched: Affected dataset(s)
        - records_inserted/records_updated: Data change counts
        - error_message: Error details if failed
    """
    from services.fetcher import DataFetcher

    trigger_time = datetime.utcnow()
    target = dataset_id or "all active"
    logger.info(
        "MANUAL_FETCH_START: Triggered at %s for dataset: %s",
        trigger_time.isoformat(),
        target,
    )

    try:
        async with DataFetcher() as fetcher:
            if dataset_id:
                result = await fetcher.fetch_dataset(dataset_id)
                response = {
                    "success": result.success,
                    "dataset_id": result.dataset_id,
                    "records_inserted": result.records_inserted,
                    "records_updated": result.records_updated,
                    "records_skipped": result.records_skipped,
                    "duration_seconds": result.duration_seconds,
                    "error_message": result.error_message,
                    "warnings": result.warnings,
                }

                if result.success:
                    logger.info(
                        "MANUAL_FETCH_SUCCESS: dataset_id=%s, inserted=%d, "
                        "updated=%d, duration=%.2fs",
                        result.dataset_id,
                        result.records_inserted,
                        result.records_updated,
                        result.duration_seconds,
                    )
                else:
                    logger.error(
                        "MANUAL_FETCH_FAILED: dataset_id=%s, error=%s, duration=%.2fs",
                        result.dataset_id,
                        result.error_message,
                        result.duration_seconds,
                    )

                return response
            else:
                results = await fetcher.fetch_all_active(force=True)
                successful = sum(1 for r in results if r.success)
                failed = sum(1 for r in results if not r.success)
                total_inserted = sum(r.records_inserted for r in results if r.success)
                total_updated = sum(r.records_updated for r in results if r.success)

                response = {
                    "success": failed == 0,
                    "datasets_fetched": len(results),
                    "successful": successful,
                    "failed": failed,
                    "total_records_inserted": total_inserted,
                    "total_records_updated": total_updated,
                    "errors": [
                        {"dataset_id": r.dataset_id, "error": r.error_message}
                        for r in results if not r.success
                    ],
                }

                logger.info(
                    "MANUAL_FETCH_COMPLETE: datasets=%d, successful=%d, failed=%d, "
                    "inserted=%d, updated=%d",
                    len(results),
                    successful,
                    failed,
                    total_inserted,
                    total_updated,
                )

                return response

    except Exception as e:
        logger.error(
            "MANUAL_FETCH_ERROR: Critical error for %s: %s\n%s",
            target,
            str(e),
            traceback.format_exc(),
        )
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
        }


def start_worker() -> None:
    """Start the background worker and scheduler.

    This function initializes the scheduler and starts it running.
    It should be called once to begin processing jobs.
    """
    if scheduler.running:
        logger.warning("Scheduler is already running")
        return

    setup_jobs()
    scheduler.start()
    logger.info("Worker started with scheduler")


def stop_worker() -> None:
    """Stop the background worker gracefully.

    Shuts down the scheduler and waits for any running jobs to complete.
    """
    if not scheduler.running:
        logger.warning("Scheduler is not running")
        return

    logger.info("Stopping worker...")
    scheduler.shutdown(wait=True)
    logger.info("Worker stopped")


async def main() -> None:
    """Main entry point for running the worker as a standalone process.

    Sets up signal handlers for graceful shutdown and runs the scheduler.
    """
    # Initialize database first
    await initialize_database()

    # Set up signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()

    def shutdown_handler(sig: signal.Signals) -> None:
        """Handle shutdown signals."""
        logger.info("Received signal %s, shutting down...", sig.name)
        stop_worker()
        loop.stop()

    # Register signal handlers (Unix only)
    if sys.platform != "win32":
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda s=sig: shutdown_handler(s))

    # Start the worker
    start_worker()

    logger.info("Worker is running. Press Ctrl+C to stop.")

    try:
        # Keep the event loop running
        while scheduler.running:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Received shutdown signal")
    finally:
        stop_worker()


if __name__ == "__main__":
    asyncio.run(main())
