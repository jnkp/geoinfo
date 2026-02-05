"""Data fetching orchestration service with normalization.

This module provides the DataFetcher service that orchestrates data fetching
from the StatFin API and normalizes the data for storage in the database.

The DataFetcher:
- Fetches data based on FetchConfig configurations
- Parses JSON-stat responses via StatFinClient
- Normalizes data to the Statistic model schema
- Handles dimension mapping (time, region, industry)
- Updates fetch status tracking
- Provides concurrent fetch capabilities with rate limiting

Usage:
    async with DataFetcher() as fetcher:
        result = await fetcher.fetch_dataset("my-dataset-id")
        stats = await fetcher.fetch_all_active()
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models.database import async_session_maker
from models.dimensions import Industry, Region
from models.fetch_config import FetchConfig
from models.statistics import Dataset, Statistic
from services.statfin import (
    StatFinClient,
    StatFinDataset,
    StatFinError,
    StatFinRateLimitError,
)

logger = logging.getLogger(__name__)


@dataclass
class FetchResult:
    """Result of a data fetch operation.

    Attributes:
        success: Whether the fetch was successful
        dataset_id: ID of the fetched dataset
        records_fetched: Number of data points retrieved from StatFin
        records_inserted: Number of records inserted into database
        records_updated: Number of records updated in database
        records_skipped: Number of records skipped (duplicates/unchanged)
        duration_seconds: Time taken for the fetch operation
        error_message: Error message if fetch failed
        warnings: List of non-fatal warnings during fetch
    """

    success: bool
    dataset_id: str
    records_fetched: int = 0
    records_inserted: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    duration_seconds: float = 0.0
    error_message: Optional[str] = None
    warnings: list[str] = field(default_factory=list)

    def __str__(self) -> str:
        if self.success:
            return (
                f"FetchResult(dataset={self.dataset_id}, success=True, "
                f"fetched={self.records_fetched}, inserted={self.records_inserted}, "
                f"updated={self.records_updated}, skipped={self.records_skipped}, "
                f"duration={self.duration_seconds:.2f}s)"
            )
        return f"FetchResult(dataset={self.dataset_id}, success=False, error={self.error_message!r})"


@dataclass
class NormalizedRecord:
    """A normalized record ready for database insertion.

    Attributes:
        year: Year of the statistic (required)
        quarter: Quarter (1-4) for quarterly data
        month: Month (1-12) for monthly data
        region_code: Region code for geographic linkage
        industry_code: Industry code for sector linkage
        value: The numeric statistic value
        value_label: Label identifying the value type/measure
        unit: Unit of measurement
    """

    year: int
    quarter: Optional[int] = None
    month: Optional[int] = None
    region_code: Optional[str] = None
    industry_code: Optional[str] = None
    value: Optional[float] = None
    value_label: Optional[str] = None
    unit: Optional[str] = None


class DataNormalizer:
    """Normalizes StatFin data to database schema format.

    This class handles the transformation of raw StatFin data points
    into normalized records suitable for database insertion. It:
    - Parses time dimension values into year/quarter/month components
    - Maps region codes to the standard format
    - Maps industry codes to TOL 2008 format
    - Extracts value labels and units
    """

    # Common StatFin time dimension names
    TIME_DIMENSION_NAMES = {"Vuosi", "Year", "Kuukausi", "Month", "Vuosineljännes", "Quarter"}

    # Common StatFin region dimension names
    REGION_DIMENSION_NAMES = {"Alue", "Region", "Maakunta", "Kunta", "Seutukunta"}

    # Common StatFin industry dimension names
    INDUSTRY_DIMENSION_NAMES = {"Toimiala", "Industry", "TOL"}

    # Common StatFin value dimension names
    VALUE_DIMENSION_NAMES = {"Tiedot", "Tieto", "Information", "Data"}

    # Regex patterns for parsing time values
    YEAR_PATTERN = re.compile(r"^(\d{4})$")  # e.g., "2023"
    YEAR_QUARTER_PATTERN = re.compile(r"^(\d{4})Q([1-4])$")  # e.g., "2023Q1"
    YEAR_MONTH_PATTERN = re.compile(r"^(\d{4})M(\d{1,2})$")  # e.g., "2023M01" or "2023M1"
    MONTH_YEAR_PATTERN = re.compile(r"^(\d{4})-(\d{2})$")  # e.g., "2023-01"

    def __init__(self, dataset: Dataset):
        """Initialize the normalizer for a specific dataset.

        Args:
            dataset: The Dataset model instance for context
        """
        self.dataset = dataset
        self._time_dimension: Optional[str] = None
        self._region_dimension: Optional[str] = None
        self._industry_dimension: Optional[str] = None
        self._value_dimension: Optional[str] = None

    def identify_dimensions(self, statfin_data: StatFinDataset) -> None:
        """Identify the role of each dimension in the dataset.

        Args:
            statfin_data: Parsed StatFin dataset to analyze
        """
        for dim in statfin_data.dimensions:
            dim_id_upper = dim.id.upper()
            dim_label_upper = dim.label.upper() if dim.label else ""

            # Check if this is a time dimension
            if any(name.upper() in dim_id_upper or name.upper() in dim_label_upper
                   for name in self.TIME_DIMENSION_NAMES):
                self._time_dimension = dim.id
                logger.debug("Identified time dimension: %s", dim.id)

            # Check if this is a region dimension
            elif any(name.upper() in dim_id_upper or name.upper() in dim_label_upper
                     for name in self.REGION_DIMENSION_NAMES):
                self._region_dimension = dim.id
                logger.debug("Identified region dimension: %s", dim.id)

            # Check if this is an industry dimension
            elif any(name.upper() in dim_id_upper or name.upper() in dim_label_upper
                     for name in self.INDUSTRY_DIMENSION_NAMES):
                self._industry_dimension = dim.id
                logger.debug("Identified industry dimension: %s", dim.id)

            # Check if this is a value type dimension
            elif any(name.upper() in dim_id_upper or name.upper() in dim_label_upper
                     for name in self.VALUE_DIMENSION_NAMES):
                self._value_dimension = dim.id
                logger.debug("Identified value dimension: %s", dim.id)

    def parse_time_value(self, time_code: str) -> tuple[int, Optional[int], Optional[int]]:
        """Parse a StatFin time code into year, quarter, and month components.

        Args:
            time_code: The raw time code from StatFin (e.g., "2023", "2023Q1", "2023M01")

        Returns:
            Tuple of (year, quarter, month) where quarter and month may be None

        Raises:
            ValueError: If the time code format is not recognized
        """
        # Try year only
        match = self.YEAR_PATTERN.match(time_code)
        if match:
            return int(match.group(1)), None, None

        # Try year + quarter
        match = self.YEAR_QUARTER_PATTERN.match(time_code)
        if match:
            return int(match.group(1)), int(match.group(2)), None

        # Try year + month (M format)
        match = self.YEAR_MONTH_PATTERN.match(time_code)
        if match:
            return int(match.group(1)), None, int(match.group(2))

        # Try year + month (dash format)
        match = self.MONTH_YEAR_PATTERN.match(time_code)
        if match:
            return int(match.group(1)), None, int(match.group(2))

        # If nothing matches, try to extract just the year
        year_match = re.search(r"(\d{4})", time_code)
        if year_match:
            logger.warning(
                "Could not fully parse time code '%s', extracted year only: %s",
                time_code,
                year_match.group(1),
            )
            return int(year_match.group(1)), None, None

        raise ValueError(f"Unrecognized time code format: {time_code}")

    def normalize_region_code(self, code: str) -> str:
        """Normalize a region code to the standard format.

        StatFin region codes may include prefixes like "SSS" for whole country
        or "MK" for maakunta. This method normalizes them to our standard format.

        Args:
            code: Raw region code from StatFin

        Returns:
            Normalized region code
        """
        # Handle special codes
        if code.upper() in ("SSS", "KOKO MAA", "WHOLE COUNTRY"):
            return "SSS"  # Whole country code

        # Remove common prefixes if present
        normalized = code.strip()

        # If it starts with MK and has digits, it's a maakunta code
        if normalized.upper().startswith("MK") and len(normalized) > 2:
            normalized = normalized[2:]

        return normalized

    def normalize_industry_code(self, code: str) -> str:
        """Normalize an industry code to TOL 2008 format.

        Args:
            code: Raw industry code from StatFin

        Returns:
            Normalized industry code
        """
        normalized = code.strip().upper()

        # Remove common prefixes like "TOL_" or "TOL2008_"
        if normalized.startswith("TOL_"):
            normalized = normalized[4:]
        elif normalized.startswith("TOL2008_"):
            normalized = normalized[8:]

        return normalized

    def normalize_records(
        self, statfin_data: StatFinDataset
    ) -> list[NormalizedRecord]:
        """Normalize all data points from a StatFin dataset.

        Args:
            statfin_data: Parsed StatFin dataset

        Returns:
            List of normalized records ready for database insertion
        """
        # First identify dimensions
        self.identify_dimensions(statfin_data)

        records: list[NormalizedRecord] = []
        data_points = statfin_data.get_data_points()

        for dp in data_points:
            try:
                record = self._normalize_data_point(dp.coordinates, dp.labels, dp.value)
                if record:
                    records.append(record)
            except Exception as e:
                logger.warning(
                    "Failed to normalize data point %s: %s",
                    dp.coordinates,
                    str(e),
                )
                continue

        logger.info(
            "Normalized %d of %d data points for dataset %s",
            len(records),
            len(data_points),
            self.dataset.id,
        )
        return records

    def _normalize_data_point(
        self,
        coordinates: dict[str, str],
        labels: dict[str, str],
        value: Optional[float],
    ) -> Optional[NormalizedRecord]:
        """Normalize a single data point.

        Args:
            coordinates: Dimension code -> value code mapping
            labels: Dimension code -> value label mapping
            value: The numeric value

        Returns:
            NormalizedRecord or None if normalization fails
        """
        year: Optional[int] = None
        quarter: Optional[int] = None
        month: Optional[int] = None
        region_code: Optional[str] = None
        industry_code: Optional[str] = None
        value_label: Optional[str] = None

        # Extract time components
        if self._time_dimension and self._time_dimension in coordinates:
            time_code = coordinates[self._time_dimension]
            try:
                year, quarter, month = self.parse_time_value(time_code)
            except ValueError as e:
                logger.warning("Failed to parse time code: %s", e)
                return None

        # If no time dimension identified, try common dimension names
        if year is None:
            for dim_name in ["Vuosi", "Year"]:
                if dim_name in coordinates:
                    try:
                        year, quarter, month = self.parse_time_value(coordinates[dim_name])
                        break
                    except ValueError:
                        continue

        # Year is required
        if year is None:
            logger.warning("Could not determine year for data point: %s", coordinates)
            return None

        # Extract region code
        if self._region_dimension and self._region_dimension in coordinates:
            region_code = self.normalize_region_code(coordinates[self._region_dimension])
        else:
            for dim_name in ["Alue", "Region", "Maakunta", "Kunta"]:
                if dim_name in coordinates:
                    region_code = self.normalize_region_code(coordinates[dim_name])
                    break

        # Extract industry code
        if self._industry_dimension and self._industry_dimension in coordinates:
            industry_code = self.normalize_industry_code(coordinates[self._industry_dimension])
        else:
            for dim_name in ["Toimiala", "Industry"]:
                if dim_name in coordinates:
                    industry_code = self.normalize_industry_code(coordinates[dim_name])
                    break

        # Extract value label
        if self._value_dimension and self._value_dimension in labels:
            value_label = labels[self._value_dimension]
        else:
            for dim_name in ["Tiedot", "Information"]:
                if dim_name in labels:
                    value_label = labels[dim_name]
                    break

        return NormalizedRecord(
            year=year,
            quarter=quarter,
            month=month,
            region_code=region_code,
            industry_code=industry_code,
            value=value,
            value_label=value_label,
        )


class DataFetcher:
    """Orchestrates data fetching from StatFin API with database storage.

    This class coordinates the full fetch workflow:
    1. Load fetch configuration from database
    2. Fetch data from StatFin API via StatFinClient
    3. Normalize data using DataNormalizer
    4. Store/update records in the database
    5. Update fetch status tracking

    Usage:
        async with DataFetcher() as fetcher:
            # Fetch a single dataset
            result = await fetcher.fetch_dataset("dataset-id")

            # Fetch all active configurations
            results = await fetcher.fetch_all_active()
    """

    # Maximum concurrent fetches to avoid overwhelming the API
    MAX_CONCURRENT_FETCHES = 3

    # Minimum delay between fetches (seconds) for rate limiting
    MIN_FETCH_DELAY = 1.0

    def __init__(
        self,
        statfin_client: Optional[StatFinClient] = None,
        max_concurrent: int = MAX_CONCURRENT_FETCHES,
    ):
        """Initialize the DataFetcher.

        Args:
            statfin_client: Optional pre-configured StatFinClient instance
            max_concurrent: Maximum number of concurrent fetch operations
        """
        self._client = statfin_client
        self._owns_client = statfin_client is None
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def __aenter__(self) -> "DataFetcher":
        """Async context manager entry."""
        if self._client is None:
            self._client = StatFinClient()
            await self._client._ensure_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        if self._owns_client and self._client is not None:
            await self._client.close()
            self._client = None

    @property
    def client(self) -> StatFinClient:
        """Get the StatFin client, ensuring it's initialized."""
        if self._client is None:
            raise RuntimeError("DataFetcher not initialized. Use 'async with' context manager.")
        return self._client

    async def fetch_dataset(
        self,
        dataset_id: str,
        query_override: Optional[dict[str, Any]] = None,
        session: Optional[AsyncSession] = None,
    ) -> FetchResult:
        """Fetch data for a single dataset.

        Args:
            dataset_id: ID of the dataset to fetch
            query_override: Optional query to use instead of default
            session: Optional database session (creates new if not provided)

        Returns:
            FetchResult with details of the fetch operation
        """
        start_time = datetime.utcnow()
        result = FetchResult(success=False, dataset_id=dataset_id)

        async with self._semaphore:
            try:
                # Get or create database session
                close_session = session is None
                if session is None:
                    session = async_session_maker()

                try:
                    result = await self._do_fetch(
                        dataset_id, query_override, session, start_time
                    )

                    if result.success:
                        await session.commit()
                    else:
                        await session.rollback()

                finally:
                    if close_session:
                        await session.close()

            except Exception as e:
                logger.exception("Unexpected error fetching dataset %s", dataset_id)
                result.error_message = str(e)
                result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()

        return result

    async def _do_fetch(
        self,
        dataset_id: str,
        query_override: Optional[dict[str, Any]],
        session: AsyncSession,
        start_time: datetime,
    ) -> FetchResult:
        """Internal fetch implementation.

        Args:
            dataset_id: ID of the dataset to fetch
            query_override: Optional query override
            session: Database session
            start_time: When the fetch started

        Returns:
            FetchResult with details of the operation
        """
        result = FetchResult(success=False, dataset_id=dataset_id)

        # Load dataset configuration
        dataset = await session.get(Dataset, dataset_id)
        if dataset is None:
            result.error_message = f"Dataset not found: {dataset_id}"
            result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
            return result

        # Load fetch configuration
        fetch_config_query = select(FetchConfig).where(FetchConfig.dataset_id == dataset_id)
        fetch_config_result = await session.execute(fetch_config_query)
        fetch_config = fetch_config_result.scalar_one_or_none()

        logger.info(
            "Starting fetch for dataset %s (table: %s)",
            dataset_id,
            dataset.statfin_table_id,
        )

        try:
            # Build query (use override or default all data)
            if query_override:
                query = query_override
            else:
                query = self.client.build_query({})  # Empty query fetches all data

            # Fetch from StatFin API
            statfin_data = await self.client.fetch_and_parse(
                dataset.statfin_table_id, query
            )
            result.records_fetched = statfin_data.total_cells

            logger.info(
                "Fetched %d data points from StatFin for dataset %s",
                result.records_fetched,
                dataset_id,
            )

            # Normalize the data
            normalizer = DataNormalizer(dataset)
            normalized_records = normalizer.normalize_records(statfin_data)

            # Store in database
            insert_result = await self._store_records(
                session, dataset, normalized_records
            )
            result.records_inserted = insert_result["inserted"]
            result.records_updated = insert_result["updated"]
            result.records_skipped = insert_result["skipped"]
            result.warnings.extend(insert_result.get("warnings", []))

            # Update fetch config status
            if fetch_config:
                await self._update_fetch_status(
                    session, fetch_config, success=True
                )

            result.success = True
            logger.info(
                "Successfully fetched dataset %s: %d inserted, %d updated, %d skipped",
                dataset_id,
                result.records_inserted,
                result.records_updated,
                result.records_skipped,
            )

        except StatFinRateLimitError as e:
            logger.warning("Rate limited while fetching %s: %s", dataset_id, e)
            result.error_message = f"Rate limited: {e}"
            if fetch_config:
                await self._update_fetch_status(
                    session, fetch_config, success=False, error_message=str(e)
                )

        except StatFinError as e:
            logger.error("StatFin API error fetching %s: %s", dataset_id, e)
            result.error_message = f"API error: {e}"
            if fetch_config:
                await self._update_fetch_status(
                    session, fetch_config, success=False, error_message=str(e)
                )

        except Exception as e:
            logger.exception("Error fetching dataset %s", dataset_id)
            result.error_message = str(e)
            if fetch_config:
                await self._update_fetch_status(
                    session, fetch_config, success=False, error_message=str(e)
                )

        result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
        return result

    async def _store_records(
        self,
        session: AsyncSession,
        dataset: Dataset,
        records: list[NormalizedRecord],
    ) -> dict[str, Any]:
        """Store normalized records in the database.

        Args:
            session: Database session
            dataset: Parent dataset
            records: Normalized records to store

        Returns:
            Dict with counts: inserted, updated, skipped, warnings
        """
        result = {
            "inserted": 0,
            "updated": 0,
            "skipped": 0,
            "warnings": [],
        }

        # Get valid region and industry codes for validation
        valid_regions = await self._get_valid_codes(session, Region, "code")
        valid_industries = await self._get_valid_codes(session, Industry, "code")

        now = datetime.utcnow()
        statistics_to_add: list[Statistic] = []

        for record in records:
            # Validate region code
            region_code = record.region_code
            if region_code and region_code not in valid_regions:
                # Keep the code but log warning
                result["warnings"].append(
                    f"Unknown region code: {region_code}"
                )
                # Set to None to avoid FK constraint violation
                region_code = None

            # Validate industry code
            industry_code = record.industry_code
            if industry_code and industry_code not in valid_industries:
                result["warnings"].append(
                    f"Unknown industry code: {industry_code}"
                )
                industry_code = None

            # Create statistic record
            stat = Statistic(
                dataset_id=dataset.id,
                year=record.year,
                quarter=record.quarter,
                month=record.month,
                region_code=region_code,
                industry_code=industry_code,
                value=record.value,
                value_label=record.value_label,
                unit=record.unit,
                fetched_at=now,
            )
            statistics_to_add.append(stat)

        # Bulk insert for efficiency
        if statistics_to_add:
            session.add_all(statistics_to_add)
            result["inserted"] = len(statistics_to_add)

        return result

    async def _get_valid_codes(
        self,
        session: AsyncSession,
        model: type,
        column_name: str,
    ) -> set[str]:
        """Get all valid codes for a dimension table.

        Args:
            session: Database session
            model: SQLAlchemy model class
            column_name: Name of the code column

        Returns:
            Set of valid codes
        """
        column = getattr(model, column_name)
        query = select(column)
        result = await session.execute(query)
        return {row[0] for row in result.fetchall()}

    async def _update_fetch_status(
        self,
        session: AsyncSession,
        fetch_config: FetchConfig,
        success: bool,
        error_message: Optional[str] = None,
    ) -> None:
        """Update fetch configuration status after a fetch attempt.

        Args:
            session: Database session
            fetch_config: FetchConfig to update
            success: Whether the fetch was successful
            error_message: Error message if failed
        """
        now = datetime.utcnow()

        if success:
            fetch_config.last_fetch_status = "success"
            fetch_config.last_fetch_at = now
            fetch_config.fetch_count += 1
            fetch_config.last_error_message = None
        else:
            fetch_config.last_fetch_status = "failed"
            fetch_config.last_error_message = error_message

        # Schedule next fetch
        fetch_config.next_fetch_at = now + timedelta(hours=fetch_config.fetch_interval_hours)
        fetch_config.updated_at = now

    async def fetch_all_active(
        self,
        force: bool = False,
    ) -> list[FetchResult]:
        """Fetch data for all active configurations.

        Args:
            force: If True, fetch even if not yet due

        Returns:
            List of FetchResult for each dataset
        """
        results: list[FetchResult] = []

        async with async_session_maker() as session:
            # Query active fetch configs that are due
            query = select(FetchConfig).where(FetchConfig.is_active == True)

            if not force:
                now = datetime.utcnow()
                query = query.where(
                    (FetchConfig.next_fetch_at <= now) |
                    (FetchConfig.next_fetch_at == None)
                )

            # Order by priority (higher first), then by next_fetch_at
            query = query.order_by(
                FetchConfig.priority.desc(),
                FetchConfig.next_fetch_at.asc(),
            )

            result = await session.execute(query)
            configs = result.scalars().all()

            if not configs:
                logger.info("No active fetch configurations due for fetching")
                return results

            logger.info("Found %d datasets to fetch", len(configs))

            # Fetch each dataset with rate limiting
            for config in configs:
                fetch_result = await self.fetch_dataset(config.dataset_id)
                results.append(fetch_result)

                # Add delay between fetches for rate limiting
                if len(configs) > 1:
                    await asyncio.sleep(self.MIN_FETCH_DELAY)

        return results

    async def fetch_by_config_id(
        self,
        config_id: int,
        session: Optional[AsyncSession] = None,
    ) -> FetchResult:
        """Fetch data for a specific fetch configuration.

        Args:
            config_id: ID of the FetchConfig
            session: Optional database session

        Returns:
            FetchResult with details of the fetch operation
        """
        close_session = session is None
        if session is None:
            session = async_session_maker()

        try:
            # Get the fetch config
            config = await session.get(FetchConfig, config_id)
            if config is None:
                return FetchResult(
                    success=False,
                    dataset_id="unknown",
                    error_message=f"FetchConfig not found: {config_id}",
                )

            return await self.fetch_dataset(config.dataset_id, session=session)

        finally:
            if close_session:
                await session.close()


# Convenience function for one-off fetches
async def fetch_dataset_once(dataset_id: str) -> FetchResult:
    """Convenience function to fetch a single dataset.

    Args:
        dataset_id: ID of the dataset to fetch

    Returns:
        FetchResult with details of the fetch operation
    """
    async with DataFetcher() as fetcher:
        return await fetcher.fetch_dataset(dataset_id)
