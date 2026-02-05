"""Backend services package.

This package contains service modules for:
- StatFin API integration (statfin.py)
- Data fetching orchestration (fetcher.py)
"""

from services.statfin import StatFinClient

__all__ = ["StatFinClient"]
