"""Dimension tables for Finnish statistics data.

This module provides SQLAlchemy models for dimension tables that support
multi-dimensional statistics queries:
- Region: Finnish geographic regions (kunta, seutukunta, maakunta levels)
- Industry: Industry/sector classifications (TOL 2008 standard)

These dimension tables serve as foreign key references for statistics data,
enabling efficient filtering and aggregation across geographic and industry
dimensions.
"""

from typing import Optional

from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class Region(Base):
    """Finnish geographic region dimension table.

    Supports hierarchical geographic levels used by Statistics Finland:
    - kunta (municipality): Most granular level, e.g., "091" (Helsinki)
    - seutukunta (sub-region): Group of municipalities, e.g., "011" (Helsinki region)
    - maakunta (region): Highest level, e.g., "01" (Uusimaa)

    The region_level column indicates the administrative level.
    Parent-child relationships allow traversing the hierarchy.

    Attributes:
        code: Official Statistics Finland region code (primary key)
        name_fi: Finnish name of the region
        name_sv: Swedish name of the region (optional)
        name_en: English name of the region (optional)
        region_level: Administrative level (kunta, seutukunta, maakunta)
        parent_code: Code of the parent region in hierarchy (optional)
    """

    __tablename__ = "regions"

    # Primary key - Statistics Finland official code
    code: Mapped[str] = mapped_column(String(20), primary_key=True)

    # Names in multiple languages (Finnish official, Swedish official, English)
    name_fi: Mapped[str] = mapped_column(String(255), nullable=False)
    name_sv: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Administrative level for hierarchical queries
    region_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="Administrative level: kunta, seutukunta, or maakunta",
    )

    # Hierarchical relationship - parent region code
    parent_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        index=True,
        comment="Parent region code for hierarchy traversal",
    )

    # Optional geometry data for map visualization
    # Note: Actual geometry stored separately or via PostGIS extension
    geometry_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="GeoJSON geometry for map rendering (optional)",
    )

    # Composite indexes for efficient filtering
    __table_args__ = (
        Index("idx_regions_level_code", "region_level", "code"),
        {"comment": "Finnish geographic regions for statistics linkage"},
    )

    def __repr__(self) -> str:
        """Return string representation of Region."""
        return f"<Region(code={self.code!r}, name_fi={self.name_fi!r}, level={self.region_level!r})>"


class Industry(Base):
    """Industry/sector dimension table using TOL 2008 classification.

    Based on Statistics Finland's TOL 2008 (Toimialaluokitus 2008) which is
    the Finnish implementation of NACE Rev. 2 industry classification.

    Supports hierarchical industry codes:
    - Section level: Single letter (e.g., "A" - Agriculture)
    - Division level: 2 digits (e.g., "01" - Crop and animal production)
    - Group level: 3 digits (e.g., "011" - Growing of non-perennial crops)
    - Class level: 4 digits (e.g., "0111" - Growing of cereals)

    Attributes:
        code: TOL 2008 industry code (primary key)
        name_fi: Finnish name of the industry
        name_sv: Swedish name of the industry (optional)
        name_en: English name of the industry (optional)
        level: Classification level (section, division, group, class)
        parent_code: Code of the parent industry in hierarchy (optional)
    """

    __tablename__ = "industries"

    # Primary key - TOL 2008 code
    code: Mapped[str] = mapped_column(String(10), primary_key=True)

    # Names in multiple languages
    name_fi: Mapped[str] = mapped_column(String(500), nullable=False)
    name_sv: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Classification level for hierarchical queries
    level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="Classification level: section, division, group, or class",
    )

    # Hierarchical relationship - parent industry code
    parent_code: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
        index=True,
        comment="Parent industry code for hierarchy traversal",
    )

    # Optional description for longer explanatory text
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Extended description of the industry classification",
    )

    # Composite indexes for efficient filtering
    __table_args__ = (
        Index("idx_industries_level_code", "level", "code"),
        {"comment": "Industry classifications (TOL 2008) for statistics linkage"},
    )

    def __repr__(self) -> str:
        """Return string representation of Industry."""
        return f"<Industry(code={self.code!r}, name_fi={self.name_fi!r}, level={self.level!r})>"
