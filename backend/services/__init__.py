"""Backend services package.

This package contains service modules for:
- StatFin API integration (statfin.py)
- Data fetching orchestration (fetcher.py)
"""

from services.fetcher import (
    DataFetcher,
    DataNormalizer,
    FetchResult,
    NormalizedRecord,
    fetch_dataset_once,
)
from services.statfin import (
    StatFinCategory,
    StatFinClient,
    StatFinDataPoint,
    StatFinDataset,
    StatFinDimension,
    StatFinDimensionValue,
    StatFinError,
    StatFinParsedDimension,
    StatFinRateLimitError,
    StatFinTableInfo,
    StatFinTableMetadata,
)

__all__ = [
    # Fetcher service
    "DataFetcher",
    "DataNormalizer",
    "FetchResult",
    "NormalizedRecord",
    "fetch_dataset_once",
    # StatFin client
    "StatFinCategory",
    "StatFinClient",
    "StatFinDataPoint",
    "StatFinDataset",
    "StatFinDimension",
    "StatFinDimensionValue",
    "StatFinError",
    "StatFinParsedDimension",
    "StatFinRateLimitError",
    "StatFinTableInfo",
    "StatFinTableMetadata",
]
