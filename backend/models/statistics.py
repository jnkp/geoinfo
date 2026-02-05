"""Statistics and dataset tables for Finnish statistics data.

This module provides SQLAlchemy models for storing statistics data:
- Dataset: Metadata about StatFin datasets that have been configured for fetching
- Statistic: Individual statistic data points with multi-dimensional linkage

The Statistic model uses consistent dimension keys (year, quarter, month,
region_code, industry_code) enabling efficient joins across different datasets
sharing common dimensions.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.database import Base


class Dataset(Base):
    """StatFin dataset metadata table.

    Stores information about datasets that have been configured for fetching
    from the StatFin API. Each dataset corresponds to a table in the StatFin
    database and contains metadata about its structure and content.

    Attributes:
        id: Unique identifier for the dataset (primary key)
        statfin_table_id: Original StatFin table identifier (e.g., "statfin_tyti_pxt_135y")
        name_fi: Finnish name of the dataset
        name_sv: Swedish name of the dataset (optional)
        name_en: English name of the dataset (optional)
        description: Extended description of the dataset content
        source_url: URL to the original StatFin data source
        time_resolution: Temporal granularity (year, quarter, month)
        has_region_dimension: Whether dataset includes geographic dimension
        has_industry_dimension: Whether dataset includes industry dimension
        created_at: Timestamp when dataset was first configured
        updated_at: Timestamp of last metadata update
    """

    __tablename__ = "datasets"

    # Primary key - unique identifier for internal use
    id: Mapped[str] = mapped_column(String(100), primary_key=True)

    # StatFin reference
    statfin_table_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="Original StatFin table identifier",
    )

    # Names in multiple languages
    name_fi: Mapped[str] = mapped_column(String(500), nullable=False)
    name_sv: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Description and metadata
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Extended description of the dataset content",
    )

    source_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="URL to the original StatFin data source",
    )

    # Dimension availability flags - for query optimization
    time_resolution: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="year",
        comment="Temporal granularity: year, quarter, or month",
    )

    has_region_dimension: Mapped[bool] = mapped_column(
        default=False,
        comment="Whether dataset includes geographic dimension",
    )

    has_industry_dimension: Mapped[bool] = mapped_column(
        default=False,
        comment="Whether dataset includes industry dimension",
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        comment="Timestamp when dataset was first configured",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        comment="Timestamp of last metadata update",
    )

    # Relationship to statistics (one-to-many)
    statistics: Mapped[list["Statistic"]] = relationship(
        "Statistic",
        back_populates="dataset",
        cascade="all, delete-orphan",
    )

    # Indexes for efficient querying
    __table_args__ = (
        Index("idx_datasets_time_resolution", "time_resolution"),
        Index("idx_datasets_dimensions", "has_region_dimension", "has_industry_dimension"),
        {"comment": "StatFin dataset metadata for configured data fetching"},
    )

    def __repr__(self) -> str:
        """Return string representation of Dataset."""
        return f"<Dataset(id={self.id!r}, name_fi={self.name_fi!r}, statfin_table_id={self.statfin_table_id!r})>"


class Statistic(Base):
    """Individual statistic data point with multi-dimensional linkage.

    Stores actual statistic values with foreign key references to dimension
    tables, enabling efficient multi-dimensional queries and cross-dataset
    linkage based on shared dimensions.

    The primary linkage keys are:
    - Time: year (required), quarter (optional), month (optional)
    - Geography: region_code (optional, FK to regions.code)
    - Industry: industry_code (optional, FK to industries.code)

    Attributes:
        id: Auto-incrementing primary key
        dataset_id: Foreign key to the parent dataset
        year: Year of the statistic (required for all data)
        quarter: Quarter (1-4) for quarterly data
        month: Month (1-12) for monthly data
        region_code: Foreign key to regions.code
        industry_code: Foreign key to industries.code
        value: The numeric statistic value
        value_label: Optional label for the value type/measure
        unit: Unit of measurement (e.g., "persons", "EUR", "%")
        data_quality: Quality indicator (optional)
        fetched_at: Timestamp when data was fetched from StatFin
    """

    __tablename__ = "statistics"

    # Primary key - auto-incrementing for unique identification
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Parent dataset reference
    dataset_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent dataset identifier",
    )

    # Time dimensions (linkage keys)
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="Year of the statistic (required)",
    )

    quarter: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="Quarter (1-4) for quarterly data",
    )

    month: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="Month (1-12) for monthly data",
    )

    # Geographic dimension (linkage key)
    region_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("regions.code", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Region code for geographic linkage",
    )

    # Industry dimension (linkage key)
    industry_code: Mapped[Optional[str]] = mapped_column(
        String(10),
        ForeignKey("industries.code", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Industry code for sector linkage",
    )

    # Value and metadata
    value: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="The numeric statistic value (null for missing data)",
    )

    value_label: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Label identifying the value type/measure within the dataset",
    )

    unit: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Unit of measurement (e.g., 'persons', 'EUR', '%')",
    )

    data_quality: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Quality indicator (e.g., 'final', 'preliminary', 'estimate')",
    )

    # Fetch metadata
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        comment="Timestamp when data was fetched from StatFin",
    )

    # Relationship to dataset
    dataset: Mapped["Dataset"] = relationship(
        "Dataset",
        back_populates="statistics",
    )

    # Composite indexes for efficient multi-dimensional queries
    __table_args__ = (
        # Primary composite index for time-region-industry queries
        Index("idx_time_region_industry", "year", "region_code", "industry_code"),
        # Dataset-specific queries with time filtering
        Index("idx_dataset_year", "dataset_id", "year"),
        # Full dimensional query support
        Index(
            "idx_dataset_full_dimensions",
            "dataset_id",
            "year",
            "quarter",
            "month",
            "region_code",
            "industry_code",
        ),
        # Time period queries across all datasets
        Index("idx_year_quarter_month", "year", "quarter", "month"),
        {"comment": "Statistics data with multi-dimensional linkage keys"},
    )

    def __repr__(self) -> str:
        """Return string representation of Statistic."""
        return (
            f"<Statistic(id={self.id}, dataset_id={self.dataset_id!r}, "
            f"year={self.year}, region_code={self.region_code!r}, value={self.value})>"
        )
