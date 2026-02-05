"""API routes package.

This package contains FastAPI routers for the Finnish Statistics API:
- datasets.py: CRUD operations for dataset metadata
"""

from api.routes.datasets import router as datasets_router

__all__ = [
    "datasets_router",
]
