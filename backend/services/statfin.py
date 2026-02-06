"""StatFin API client for fetching Finnish statistics.

This module provides an async HTTP client for interacting with the StatFin
PxWeb API. It supports:
- Listing available tables and browsing the hierarchy
- Fetching table metadata (dimensions, values)
- Querying data with specified dimension filters
- Rate limiting with exponential backoff

StatFin API Documentation:
https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/

The API uses POST requests with JSON query bodies for data fetching.
Responses are typically in JSON-stat format.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

from config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class StatFinError(Exception):
    """Base exception for StatFin API errors."""

    message: str
    status_code: Optional[int] = None
    response_body: Optional[str] = None

    def __str__(self) -> str:
        if self.status_code:
            return f"StatFin API error ({self.status_code}): {self.message}"
        return f"StatFin API error: {self.message}"


@dataclass
class StatFinRateLimitError(StatFinError):
    """Raised when the StatFin API rate limits requests."""

    retry_after: Optional[int] = None


@dataclass
class StatFinTableInfo:
    """Information about a StatFin table or folder."""

    id: str
    text: str
    type: str  # "l" for folder/level, "t" for table
    path: list[str] = field(default_factory=list)

    @property
    def is_table(self) -> bool:
        """Check if this node is a table (not a folder)."""
        return self.type == "t"

    @property
    def is_folder(self) -> bool:
        """Check if this node is a folder."""
        return self.type == "l"


@dataclass
class StatFinDimensionValue:
    """A single value within a dimension."""

    code: str
    text: str


@dataclass
class StatFinDimension:
    """A dimension from a StatFin table."""

    name: str  # Internal name (e.g., "Alue", "Vuosi")
    text: str  # Display text
    values: list[StatFinDimensionValue] = field(default_factory=list)
    elimination: bool = False  # If True, dimension can be filtered out
    time: bool = False  # If True, this is the time dimension


@dataclass
class StatFinTableMetadata:
    """Metadata for a StatFin table."""

    table_id: str
    title: str
    dimensions: list[StatFinDimension] = field(default_factory=list)
    last_updated: Optional[str] = None
    source: Optional[str] = None


@dataclass
class StatFinCategory:
    """A category (dimension value) in a parsed JSON-stat dataset."""

    index: int  # Position in the dimension
    code: str  # Dimension value code
    label: str  # Human-readable label


@dataclass
class StatFinParsedDimension:
    """A parsed dimension from a JSON-stat response."""

    id: str  # Dimension identifier (e.g., "Alue", "Vuosi")
    label: str  # Human-readable label
    categories: list[StatFinCategory] = field(default_factory=list)

    def get_category_by_code(self, code: str) -> Optional[StatFinCategory]:
        """Get a category by its code."""
        for cat in self.categories:
            if cat.code == code:
                return cat
        return None

    def get_category_by_index(self, index: int) -> Optional[StatFinCategory]:
        """Get a category by its index."""
        if 0 <= index < len(self.categories):
            return self.categories[index]
        return None


@dataclass
class StatFinDataPoint:
    """A single data point from a JSON-stat response."""

    value: Optional[float]  # The numeric value (None for missing data)
    coordinates: dict[str, str]  # Dimension code -> value code mapping
    labels: dict[str, str]  # Dimension code -> value label mapping

    @property
    def is_missing(self) -> bool:
        """Check if this data point has a missing value."""
        return self.value is None


@dataclass
class StatFinDataset:
    """A parsed JSON-stat dataset.

    This class provides easy access to the data values along with their
    dimension coordinates and labels. It supports iteration over data points
    and conversion to various formats.
    """

    label: str  # Dataset title
    source: Optional[str]  # Data source
    updated: Optional[str]  # Last update timestamp
    dimensions: list[StatFinParsedDimension] = field(default_factory=list)
    values: list[Optional[float]] = field(default_factory=list)
    _sizes: list[int] = field(default_factory=list)
    _dimension_ids: list[str] = field(default_factory=list)

    @property
    def dimension_count(self) -> int:
        """Number of dimensions in the dataset."""
        return len(self.dimensions)

    @property
    def total_cells(self) -> int:
        """Total number of data cells."""
        return len(self.values)

    def get_dimension(self, dim_id: str) -> Optional[StatFinParsedDimension]:
        """Get a dimension by its ID."""
        for dim in self.dimensions:
            if dim.id == dim_id:
                return dim
        return None

    def _index_to_coordinates(self, flat_index: int) -> list[int]:
        """Convert a flat array index to multi-dimensional coordinates.

        JSON-stat stores values in a flat array where dimensions are ordered
        from slowest-varying (first) to fastest-varying (last).
        """
        coords = []
        remaining = flat_index
        for size in self._sizes:
            divisor = 1
            for s in self._sizes[self._sizes.index(size) + 1 :]:
                divisor *= s
            coord = remaining // divisor
            remaining = remaining % divisor
            coords.append(coord)
        return coords

    def get_data_points(self) -> list[StatFinDataPoint]:
        """Get all data points with their coordinates and labels.

        Returns a list of StatFinDataPoint objects, each containing:
        - The numeric value (or None for missing data)
        - A dict mapping dimension IDs to value codes
        - A dict mapping dimension IDs to value labels
        """
        data_points = []

        for flat_idx, value in enumerate(self.values):
            coords = self._index_to_coordinates(flat_idx)
            coordinates: dict[str, str] = {}
            labels: dict[str, str] = {}

            for dim_idx, dim in enumerate(self.dimensions):
                cat_idx = coords[dim_idx]
                cat = dim.get_category_by_index(cat_idx)
                if cat:
                    coordinates[dim.id] = cat.code
                    labels[dim.id] = cat.label

            data_points.append(
                StatFinDataPoint(
                    value=value,
                    coordinates=coordinates,
                    labels=labels,
                )
            )

        return data_points

    def to_records(self) -> list[dict[str, Any]]:
        """Convert the dataset to a list of record dictionaries.

        Each record contains all dimension values (as codes) plus the
        numeric value. This format is suitable for loading into pandas
        or inserting into a database.

        Example output:
            [
                {"Alue": "SSS", "Vuosi": "2023", "Tiedot": "vaesto", "value": 5563000},
                {"Alue": "SSS", "Vuosi": "2022", "Tiedot": "vaesto", "value": 5548000},
                ...
            ]
        """
        records = []
        for dp in self.get_data_points():
            record = dict(dp.coordinates)
            record["value"] = dp.value
            records.append(record)
        return records

    def to_records_with_labels(self) -> list[dict[str, Any]]:
        """Convert the dataset to records with both codes and labels.

        Each record contains dimension values as both codes (suffixed with
        "_code") and labels (suffixed with "_label"), plus the numeric value.

        Example output:
            [
                {
                    "Alue_code": "SSS", "Alue_label": "Koko maa",
                    "Vuosi_code": "2023", "Vuosi_label": "2023",
                    "value": 5563000
                },
                ...
            ]
        """
        records = []
        for dp in self.get_data_points():
            record: dict[str, Any] = {}
            for dim_id in dp.coordinates:
                record[f"{dim_id}_code"] = dp.coordinates[dim_id]
                record[f"{dim_id}_label"] = dp.labels.get(dim_id, "")
            record["value"] = dp.value
            records.append(record)
        return records


class StatFinClient:
    """Async client for the StatFin PxWeb API.

    This client provides methods for:
    - Browsing available tables in the StatFin hierarchy
    - Fetching table metadata (dimensions and their values)
    - Querying data with dimension filters

    Usage:
        client = StatFinClient()
        async with client:
            tables = await client.list_tables()
            metadata = await client.get_table_metadata("vaerak/statfin_vaerak_pxt_11re.px")
            data = await client.fetch_table("vaerak/statfin_vaerak_pxt_11re.px", query)

    Or without context manager:
        client = StatFinClient()
        tables = await client.list_tables()
        await client.close()
    """

    # Default retry configuration
    MAX_RETRIES = 3
    INITIAL_RETRY_DELAY = 1.0  # seconds
    MAX_RETRY_DELAY = 30.0  # seconds
    RETRY_BACKOFF_FACTOR = 2.0

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = MAX_RETRIES,
    ):
        """Initialize the StatFin client.

        Args:
            base_url: Override the base URL (defaults to settings.statfin_base_url)
            timeout: HTTP request timeout in seconds
            max_retries: Maximum number of retry attempts for failed requests
        """
        settings = get_settings()
        self.base_url = (base_url or settings.statfin_base_url).rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "StatFinClient":
        """Async context manager entry."""
        await self._ensure_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()

    async def _ensure_client(self) -> httpx.AsyncClient:
        """Ensure the HTTP client is initialized."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client connection."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        path: str,
        json_data: Optional[dict[str, Any]] = None,
    ) -> Any:
        """Make an HTTP request with retry logic.

        Args:
            method: HTTP method (GET or POST)
            path: URL path relative to base_url
            json_data: JSON body for POST requests

        Returns:
            Parsed JSON response

        Raises:
            StatFinError: For API errors
            StatFinRateLimitError: When rate limited
        """
        client = await self._ensure_client()
        url = f"{self.base_url}/{path.lstrip('/')}"

        retry_delay = self.INITIAL_RETRY_DELAY
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                logger.debug(
                    "StatFin API request: %s %s (attempt %d/%d)",
                    method,
                    url,
                    attempt + 1,
                    self.max_retries + 1,
                )

                if method.upper() == "GET":
                    response = await client.get(url)
                elif method.upper() == "POST":
                    response = await client.post(url, json=json_data)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                # Check for rate limiting (HTTP 429)
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", retry_delay))
                    logger.warning(
                        "StatFin API rate limited. Retry-After: %d seconds",
                        retry_after,
                    )
                    if attempt < self.max_retries:
                        await asyncio.sleep(retry_after)
                        retry_delay = min(
                            retry_delay * self.RETRY_BACKOFF_FACTOR,
                            self.MAX_RETRY_DELAY,
                        )
                        continue
                    raise StatFinRateLimitError(
                        message="Rate limited by StatFin API",
                        status_code=429,
                        retry_after=retry_after,
                    )

                # Check for server errors (5xx) - retry
                if response.status_code >= 500:
                    logger.warning(
                        "StatFin API server error: %d. Retrying...",
                        response.status_code,
                    )
                    if attempt < self.max_retries:
                        await asyncio.sleep(retry_delay)
                        retry_delay = min(
                            retry_delay * self.RETRY_BACKOFF_FACTOR,
                            self.MAX_RETRY_DELAY,
                        )
                        continue
                    raise StatFinError(
                        message="Server error",
                        status_code=response.status_code,
                        response_body=response.text,
                    )

                # Check for client errors (4xx) - don't retry
                if response.status_code >= 400:
                    raise StatFinError(
                        message=f"Client error: {response.text}",
                        status_code=response.status_code,
                        response_body=response.text,
                    )

                # Success
                return response.json()

            except httpx.TimeoutException as e:
                logger.warning(
                    "StatFin API timeout (attempt %d/%d): %s",
                    attempt + 1,
                    self.max_retries + 1,
                    str(e),
                )
                last_error = e
                if attempt < self.max_retries:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(
                        retry_delay * self.RETRY_BACKOFF_FACTOR,
                        self.MAX_RETRY_DELAY,
                    )
                    continue

            except httpx.RequestError as e:
                logger.warning(
                    "StatFin API request error (attempt %d/%d): %s",
                    attempt + 1,
                    self.max_retries + 1,
                    str(e),
                )
                last_error = e
                if attempt < self.max_retries:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(
                        retry_delay * self.RETRY_BACKOFF_FACTOR,
                        self.MAX_RETRY_DELAY,
                    )
                    continue

        # All retries exhausted
        raise StatFinError(
            message=f"Request failed after {self.max_retries + 1} attempts: {last_error}",
        )

    async def list_tables(self, path: str = "") -> list[StatFinTableInfo]:
        """List available tables and folders at a given path.

        The StatFin API organizes tables hierarchically. Use this method to
        browse the hierarchy starting from the root or any folder path.

        Args:
            path: Path in the hierarchy (empty for root)

        Returns:
            List of tables and folders at the specified path

        Example:
            # List root categories
            root = await client.list_tables()

            # List tables in a specific category
            tables = await client.list_tables("vaerak")
        """
        logger.info("Listing StatFin tables at path: '%s'", path or "(root)")

        response = await self._request("GET", path)

        # Response is a list of items with id, type, text, and updated fields
        items: list[StatFinTableInfo] = []
        current_path = path.split("/") if path else []

        for item in response:
            item_id = item.get("id", "")
            item_text = item.get("text", "")
            item_type = item.get("type", "l")

            info = StatFinTableInfo(
                id=item_id,
                text=item_text,
                type=item_type,
                path=current_path + [item_id] if item_id else current_path,
            )
            items.append(info)

        logger.info("Found %d items at path '%s'", len(items), path or "(root)")
        return items

    async def get_table_metadata(self, table_path: str) -> StatFinTableMetadata:
        """Get metadata for a specific table.

        Fetches the table structure including all dimensions and their
        available values. This is useful for understanding what filters
        can be applied when querying data.

        Args:
            table_path: Full path to the table (e.g., "vaerak/statfin_vaerak_pxt_11re.px")

        Returns:
            Table metadata including dimensions and values

        Example:
            metadata = await client.get_table_metadata("vaerak/statfin_vaerak_pxt_11re.px")
            for dim in metadata.dimensions:
                print(f"{dim.name}: {len(dim.values)} values")
        """
        logger.info("Fetching metadata for table: %s", table_path)

        response = await self._request("GET", table_path)

        # Parse the metadata response
        title = response.get("title", "")
        variables = response.get("variables", [])

        dimensions: list[StatFinDimension] = []
        for var in variables:
            values: list[StatFinDimensionValue] = []
            var_values = var.get("values", [])
            var_texts = var.get("valueTexts", [])

            for i, code in enumerate(var_values):
                text = var_texts[i] if i < len(var_texts) else code
                values.append(StatFinDimensionValue(code=code, text=text))

            dim = StatFinDimension(
                name=var.get("code", ""),
                text=var.get("text", ""),
                values=values,
                elimination=var.get("elimination", False),
                time=var.get("time", False),
            )
            dimensions.append(dim)

        metadata = StatFinTableMetadata(
            table_id=table_path,
            title=title,
            dimensions=dimensions,
            source=response.get("source"),
            last_updated=response.get("updated"),
        )

        logger.info(
            "Table '%s' has %d dimensions: %s",
            table_path,
            len(dimensions),
            [d.name for d in dimensions],
        )
        return metadata

    async def fetch_table(
        self,
        table_path: str,
        query: dict[str, Any],
    ) -> dict[str, Any]:
        """Fetch data from a StatFin table.

        Sends a query to the StatFin API and returns the response in JSON-stat
        format. The query specifies which dimension values to include.

        Args:
            table_path: Full path to the table
            query: PxWeb query object specifying dimension filters

        Returns:
            JSON-stat response containing the requested data

        Example:
            query = {
                "query": [
                    {
                        "code": "Vuosi",
                        "selection": {
                            "filter": "item",
                            "values": ["2022", "2023"]
                        }
                    },
                    {
                        "code": "Alue",
                        "selection": {
                            "filter": "item",
                            "values": ["SSS"]  # Whole country
                        }
                    }
                ],
                "response": {"format": "json-stat2"}
            }
            data = await client.fetch_table("vaerak/statfin_vaerak_pxt_11re.px", query)
        """
        logger.info("Fetching data from table: %s", table_path)
        logger.debug("Query: %s", query)

        response = await self._request("POST", table_path, json_data=query)

        logger.info("Successfully fetched data from table: %s", table_path)
        return response

    def build_query(
        self,
        dimensions: dict[str, list[str]],
        response_format: str = "json-stat2",
    ) -> dict[str, Any]:
        """Build a PxWeb query object from dimension selections.

        Helper method to construct the query format expected by the StatFin API.

        Args:
            dimensions: Dictionary mapping dimension codes to selected values
                       Use ["*"] to select all values for a dimension
            response_format: Output format (json-stat2 recommended)

        Returns:
            Query object ready for use with fetch_table()

        Example:
            query = client.build_query({
                "Vuosi": ["2022", "2023"],
                "Alue": ["SSS", "MK01", "MK02"],
                "Tiedot": ["*"],  # All values
            })
        """
        query_parts: list[dict[str, Any]] = []

        for code, values in dimensions.items():
            if values == ["*"]:
                # Select all values
                selection = {"filter": "all", "values": ["*"]}
            else:
                # Select specific values
                selection = {"filter": "item", "values": values}

            query_parts.append({"code": code, "selection": selection})

        return {
            "query": query_parts,
            "response": {"format": response_format},
        }

    @staticmethod
    def parse_jsonstat(response: dict[str, Any]) -> StatFinDataset:
        """Parse a JSON-stat2 response into a StatFinDataset.

        Converts the raw JSON-stat2 format into a structured StatFinDataset
        object that provides easy access to data values with their dimension
        coordinates and labels.

        Args:
            response: Raw JSON-stat2 response from fetch_table()

        Returns:
            StatFinDataset with parsed dimensions and values

        Raises:
            StatFinError: If the response format is invalid

        Example:
            response = await client.fetch_table("vaerak/...", query)
            dataset = client.parse_jsonstat(response)

            # Get all data points
            for dp in dataset.get_data_points():
                print(f"{dp.labels}: {dp.value}")

            # Or convert to records for database insertion
            records = dataset.to_records()
        """
        # Validate response structure
        if "id" not in response or "dimension" not in response or "value" not in response:
            raise StatFinError(
                message="Invalid JSON-stat response: missing required fields (id, dimension, value)"
            )

        # Extract basic metadata
        label = response.get("label", "")
        source = response.get("source")
        updated = response.get("updated")

        # Parse dimension IDs and sizes
        dimension_ids: list[str] = response["id"]
        sizes: list[int] = response.get("size", [])

        # Parse dimensions
        dimensions: list[StatFinParsedDimension] = []
        raw_dimensions = response["dimension"]

        for dim_id in dimension_ids:
            if dim_id not in raw_dimensions:
                logger.warning("Dimension '%s' not found in response", dim_id)
                continue

            dim_data = raw_dimensions[dim_id]
            dim_label = dim_data.get("label", dim_id)

            # Parse categories (dimension values)
            categories: list[StatFinCategory] = []
            category_data = dim_data.get("category", {})
            index_map = category_data.get("index", {})
            label_map = category_data.get("label", {})

            # Build categories from index map
            for code, idx in index_map.items():
                cat_label = label_map.get(code, code)
                categories.append(
                    StatFinCategory(
                        index=idx,
                        code=code,
                        label=cat_label,
                    )
                )

            # Sort categories by index
            categories.sort(key=lambda c: c.index)

            dimensions.append(
                StatFinParsedDimension(
                    id=dim_id,
                    label=dim_label,
                    categories=categories,
                )
            )

        # Parse values (may contain None for missing data)
        raw_values = response["value"]
        values: list[Optional[float]] = []
        for v in raw_values:
            if v is None:
                values.append(None)
            else:
                try:
                    values.append(float(v))
                except (TypeError, ValueError):
                    values.append(None)

        dataset = StatFinDataset(
            label=label,
            source=source,
            updated=updated,
            dimensions=dimensions,
            values=values,
            _sizes=sizes,
            _dimension_ids=dimension_ids,
        )

        logger.info(
            "Parsed JSON-stat dataset: '%s' with %d dimensions and %d values",
            label,
            len(dimensions),
            len(values),
        )

        return dataset

    async def fetch_and_parse(
        self,
        table_path: str,
        query: dict[str, Any],
    ) -> StatFinDataset:
        """Fetch data from a StatFin table and parse the response.

        Convenience method that combines fetch_table() and parse_jsonstat()
        for a streamlined workflow.

        Args:
            table_path: Full path to the table
            query: PxWeb query object specifying dimension filters

        Returns:
            Parsed StatFinDataset

        Example:
            query = client.build_query({
                "Vuosi": ["2022", "2023"],
                "Alue": ["SSS"],
            })
            dataset = await client.fetch_and_parse("vaerak/...", query)

            for record in dataset.to_records():
                print(record)
        """
        response = await self.fetch_table(table_path, query)
        return self.parse_jsonstat(response)
