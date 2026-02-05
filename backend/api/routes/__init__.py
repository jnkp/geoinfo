"""API routes package.

This package contains FastAPI routers for the Finnish Statistics API:
- datasets.py: CRUD operations for dataset metadata
- statistics.py: Query statistics with multi-dimensional filtering
"""

from api.routes.datasets import router as datasets_router
from api.routes.statistics import router as statistics_router

__all__ = [
    "datasets_router",
    "statistics_router",
]
