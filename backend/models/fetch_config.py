"""Fetch configuration model for storing user selections.

This module provides SQLAlchemy model for managing data fetch configurations:
- FetchConfig: Stores user selections for scheduled data fetching from StatFin

The FetchConfig model enables users to configure which datasets to fetch,
how often to fetch them, and tracks the fetch status for monitoring and
retry handling.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.database import Base


class FetchConfig(Base):
    """Configuration for scheduled data fetching from StatFin.

    Stores user selections for which datasets to automatically fetch
    from the StatFin API. Each configuration specifies the target dataset,
    fetch schedule, and tracks execution status for monitoring.

    Attributes:
        id: Auto-incrementing primary key
        dataset_id: Foreign key to the target dataset
        name: User-friendly name for this fetch configuration
        description: Optional description of what data is being fetched
        is_active: Whether this configuration is enabled for fetching
        fetch_interval_hours: Hours between fetch attempts (default: 24)
        priority: Fetch priority for queue ordering (higher = more urgent)
        last_fetch_at: Timestamp of last successful fetch
        last_fetch_status: Status of the last fetch attempt (success, failed, pending)
        last_error_message: Error message from last failed fetch (if any)
        next_fetch_at: Scheduled time for next fetch attempt
        fetch_count: Total number of successful fetches
        created_at: Timestamp when configuration was created
        updated_at: Timestamp of last configuration update
    """

    __tablename__ = "fetch_configs"

    # Primary key - auto-incrementing for unique identification
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Target dataset reference
    dataset_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="Target dataset identifier for fetching",
    )

    # User-friendly identification
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="User-friendly name for this fetch configuration",
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Optional description of what data is being fetched",
    )

    # Scheduling configuration
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Whether this configuration is enabled for fetching",
    )

    fetch_interval_hours: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=24,
        comment="Hours between fetch attempts (default: 24)",
    )

    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        index=True,
        comment="Fetch priority for queue ordering (higher = more urgent)",
    )

    # Fetch status tracking
    last_fetch_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        comment="Timestamp of last successful fetch",
    )

    last_fetch_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        index=True,
        comment="Status of the last fetch attempt (success, failed, pending)",
    )

    last_error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Error message from last failed fetch (if any)",
    )

    next_fetch_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        index=True,
        comment="Scheduled time for next fetch attempt",
    )

    fetch_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total number of successful fetches",
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        comment="Timestamp when configuration was created",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        comment="Timestamp of last configuration update",
    )

    # Relationship to dataset
    dataset: Mapped["Dataset"] = relationship(
        "Dataset",
        back_populates="fetch_config",
    )

    # Indexes for efficient querying
    __table_args__ = (
        # Active configurations ready for fetching
        Index("idx_fetch_configs_active_next", "is_active", "next_fetch_at"),
        # Status monitoring queries
        Index("idx_fetch_configs_status_priority", "last_fetch_status", "priority"),
        {"comment": "Fetch configurations for scheduled StatFin data retrieval"},
    )

    def __repr__(self) -> str:
        """Return string representation of FetchConfig."""
        return (
            f"<FetchConfig(id={self.id}, name={self.name!r}, "
            f"dataset_id={self.dataset_id!r}, is_active={self.is_active})>"
        )
