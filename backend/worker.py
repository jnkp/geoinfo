"""Background worker for scheduled data fetching using APScheduler.

This module provides the background worker service that schedules and executes
automated data fetching jobs from the StatFin API.

The worker:
- Uses APScheduler for job scheduling with asyncio support
- Runs fetch jobs based on FetchConfig configurations
- Handles graceful shutdown and error recovery
- Provides logging for all job executions

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

    Args:
        event: The job execution event from APScheduler
    """
    job_id = event.job_id
    scheduled_run_time = event.scheduled_run_time

    if event.exception:
        logger.error(
            "Job %s failed at %s with exception: %s",
            job_id,
            scheduled_run_time,
            event.exception,
        )
    else:
        logger.info(
            "Job %s executed successfully at %s, return value: %s",
            job_id,
            scheduled_run_time,
            event.retval,
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

    Returns:
        Dict with summary of fetch results
    """
    from services.fetcher import DataFetcher

    logger.info("Starting scheduled fetch job at %s", datetime.utcnow().isoformat())

    results_summary = {
        "started_at": datetime.utcnow().isoformat(),
        "datasets_attempted": 0,
        "datasets_successful": 0,
        "datasets_failed": 0,
        "total_records_inserted": 0,
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
                else:
                    results_summary["datasets_failed"] += 1
                    results_summary["errors"].append({
                        "dataset_id": result.dataset_id,
                        "error": result.error_message,
                    })

    except Exception as e:
        logger.exception("Error in fetch job: %s", e)
        results_summary["errors"].append({
            "dataset_id": "job_execution",
            "error": str(e),
        })

    results_summary["completed_at"] = datetime.utcnow().isoformat()

    logger.info(
        "Fetch job completed: %d successful, %d failed of %d attempted",
        results_summary["datasets_successful"],
        results_summary["datasets_failed"],
        results_summary["datasets_attempted"],
    )

    return results_summary


async def trigger_fetch_now(dataset_id: Optional[str] = None) -> dict:
    """Manually trigger a fetch job outside the schedule.

    Args:
        dataset_id: Optional specific dataset to fetch. If None, fetches all active.

    Returns:
        Dict with fetch results
    """
    from services.fetcher import DataFetcher

    logger.info("Manual fetch triggered for dataset: %s", dataset_id or "all active")

    try:
        async with DataFetcher() as fetcher:
            if dataset_id:
                result = await fetcher.fetch_dataset(dataset_id)
                return {
                    "success": result.success,
                    "dataset_id": result.dataset_id,
                    "records_inserted": result.records_inserted,
                    "records_updated": result.records_updated,
                    "error_message": result.error_message,
                }
            else:
                results = await fetcher.fetch_all_active(force=True)
                return {
                    "datasets_fetched": len(results),
                    "successful": sum(1 for r in results if r.success),
                    "failed": sum(1 for r in results if not r.success),
                }

    except Exception as e:
        logger.exception("Error in manual fetch: %s", e)
        return {"success": False, "error": str(e)}


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
