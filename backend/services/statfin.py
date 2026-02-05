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
