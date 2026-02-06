"""Database models package.

This package contains SQLAlchemy models for the Finnish Statistics platform:
- database.py: Database connection and Base class
- dimensions.py: Region and Industry dimension tables
- statistics.py: Dataset and Statistic tables
- fetch_config.py: FetchConfig table for scheduling data fetches
"""

from models.database import Base, engine, async_session_maker, get_db
from models.dimensions import Region, Industry
from models.statistics import Dataset, Statistic
from models.fetch_config import FetchConfig

__all__ = [
    "Base",
    "engine",
    "async_session_maker",
    "get_db",
    "Region",
    "Industry",
    "Dataset",
    "Statistic",
    "FetchConfig",
]
