"""Pydantic schemas for API request/response validation.

This module provides Pydantic models for validating and serializing API data:
- Dataset schemas: Create, update, and response models for dataset metadata
- Statistic schemas: Response models and query filters for statistics data
- Region schemas: Response models for geographic dimension data
- Industry schemas: Response models for industry dimension data
- FetchConfig schemas: Create, update, and response models for fetch configurations

All response schemas use ConfigDict(from_attributes=True) for ORM compatibility
with SQLAlchemy models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Region Schemas
# =============================================================================


class RegionBase(BaseModel):
    """Base schema for region data."""

    code: str = Field(..., description="Statistics Finland official region code")
    name_fi: str = Field(..., description="Finnish name of the region")
    name_sv: Optional[str] = Field(None, description="Swedish name of the region")
    name_en: Optional[str] = Field(None, description="English name of the region")
    region_level: str = Field(
        ..., description="Administrative level: kunta, seutukunta, or maakunta"
    )
    parent_code: Optional[str] = Field(
        None, description="Parent region code for hierarchy traversal"
    )


class RegionCreate(RegionBase):
    """Schema for creating a new region."""

    geometry_json: Optional[str] = Field(
        None, description="GeoJSON geometry for map rendering"
    )


class RegionResponse(RegionBase):
    """Schema for region API response."""

    model_config = ConfigDict(from_attributes=True)

    geometry_json: Optional[str] = Field(
        None, description="GeoJSON geometry for map rendering"
    )


class RegionListResponse(BaseModel):
    """Schema for paginated region list response."""

    items: list[RegionResponse]
    total: int
    page: int
    page_size: int


# =============================================================================
# Industry Schemas
# =============================================================================


class IndustryBase(BaseModel):
    """Base schema for industry data."""

    code: str = Field(..., description="TOL 2008 industry code")
    name_fi: str = Field(..., description="Finnish name of the industry")
    name_sv: Optional[str] = Field(None, description="Swedish name of the industry")
    name_en: Optional[str] = Field(None, description="English name of the industry")
    level: str = Field(
        ..., description="Classification level: section, division, group, or class"
    )
    parent_code: Optional[str] = Field(
        None, description="Parent industry code for hierarchy traversal"
    )


class IndustryCreate(IndustryBase):
    """Schema for creating a new industry."""

    description: Optional[str] = Field(
        None, description="Extended description of the industry classification"
    )


class IndustryResponse(IndustryBase):
    """Schema for industry API response."""

    model_config = ConfigDict(from_attributes=True)

    description: Optional[str] = Field(
        None, description="Extended description of the industry classification"
    )


class IndustryListResponse(BaseModel):
    """Schema for paginated industry list response."""

    items: list[IndustryResponse]
    total: int
    page: int
    page_size: int


# =============================================================================
# Dataset Schemas
# =============================================================================


class DatasetBase(BaseModel):
    """Base schema for dataset metadata."""

    statfin_table_id: str = Field(
        ..., description="Original StatFin table identifier"
    )
    name_fi: str = Field(..., description="Finnish name of the dataset")
    name_sv: Optional[str] = Field(None, description="Swedish name of the dataset")
    name_en: Optional[str] = Field(None, description="English name of the dataset")
    description: Optional[str] = Field(
        None, description="Extended description of the dataset content"
    )
    source_url: Optional[str] = Field(
        None, description="URL to the original StatFin data source"
    )
    time_resolution: str = Field(
        "year", description="Temporal granularity: year, quarter, or month"
    )
    has_region_dimension: bool = Field(
        False, description="Whether dataset includes geographic dimension"
    )
    has_industry_dimension: bool = Field(
        False, description="Whether dataset includes industry dimension"
    )


class DatasetCreate(DatasetBase):
    """Schema for creating a new dataset.

    The id field is required when creating a dataset and serves as
    the unique identifier for internal use.
    """

    id: str = Field(..., description="Unique identifier for the dataset")


class DatasetUpdate(BaseModel):
    """Schema for updating dataset metadata.

    All fields are optional to allow partial updates.
    """

    name_fi: Optional[str] = Field(None, description="Finnish name of the dataset")
    name_sv: Optional[str] = Field(None, description="Swedish name of the dataset")
    name_en: Optional[str] = Field(None, description="English name of the dataset")
    description: Optional[str] = Field(
        None, description="Extended description of the dataset content"
    )
    source_url: Optional[str] = Field(
        None, description="URL to the original StatFin data source"
    )
    time_resolution: Optional[str] = Field(
        None, description="Temporal granularity: year, quarter, or month"
    )
    has_region_dimension: Optional[bool] = Field(
        None, description="Whether dataset includes geographic dimension"
    )
    has_industry_dimension: Optional[bool] = Field(
        None, description="Whether dataset includes industry dimension"
    )


class DatasetResponse(DatasetBase):
    """Schema for dataset API response."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique identifier for the dataset")
    created_at: datetime = Field(
        ..., description="Timestamp when dataset was first configured"
    )
    updated_at: datetime = Field(
        ..., description="Timestamp of last metadata update"
    )


class DatasetListResponse(BaseModel):
    """Schema for paginated dataset list response."""

    items: list[DatasetResponse]
    total: int
    page: int
    page_size: int


# =============================================================================
# Statistic Schemas
# =============================================================================


class StatisticBase(BaseModel):
    """Base schema for statistic data points."""

    dataset_id: str = Field(..., description="Parent dataset identifier")
    year: int = Field(..., description="Year of the statistic (required)")
    quarter: Optional[int] = Field(
        None, ge=1, le=4, description="Quarter (1-4) for quarterly data"
    )
    month: Optional[int] = Field(
        None, ge=1, le=12, description="Month (1-12) for monthly data"
    )
    region_code: Optional[str] = Field(
        None, description="Region code for geographic linkage"
    )
    industry_code: Optional[str] = Field(
        None, description="Industry code for sector linkage"
    )
    value: Optional[float] = Field(
        None, description="The numeric statistic value (null for missing data)"
    )
    value_label: Optional[str] = Field(
        None, description="Label identifying the value type/measure within the dataset"
    )
    unit: Optional[str] = Field(
        None, description="Unit of measurement (e.g., 'persons', 'EUR', '%')"
    )
    data_quality: Optional[str] = Field(
        None, description="Quality indicator (e.g., 'final', 'preliminary', 'estimate')"
    )


class StatisticCreate(StatisticBase):
    """Schema for creating a new statistic data point."""

    pass


class StatisticResponse(StatisticBase):
    """Schema for statistic API response."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Unique identifier for the statistic")
    fetched_at: datetime = Field(
        ..., description="Timestamp when data was fetched from StatFin"
    )


class StatisticWithRegion(StatisticResponse):
    """Schema for statistic response with embedded region data."""

    region: Optional[RegionResponse] = Field(
        None, description="Region details for geographic dimension"
    )


class StatisticWithIndustry(StatisticResponse):
    """Schema for statistic response with embedded industry data."""

    industry: Optional[IndustryResponse] = Field(
        None, description="Industry details for sector dimension"
    )


class StatisticFull(StatisticResponse):
    """Schema for statistic response with all embedded dimension data."""

    region: Optional[RegionResponse] = Field(
        None, description="Region details for geographic dimension"
    )
    industry: Optional[IndustryResponse] = Field(
        None, description="Industry details for sector dimension"
    )


class StatisticListResponse(BaseModel):
    """Schema for paginated statistic list response."""

    items: list[StatisticResponse]
    total: int
    page: int
    page_size: int


class StatisticQueryParams(BaseModel):
    """Schema for statistic query filter parameters.

    Used to filter statistics by various dimensions when querying the API.
    """

    dataset_id: Optional[str] = Field(None, description="Filter by dataset ID")
    year: Optional[int] = Field(None, description="Filter by year")
    year_from: Optional[int] = Field(None, description="Filter by minimum year")
    year_to: Optional[int] = Field(None, description="Filter by maximum year")
    quarter: Optional[int] = Field(
        None, ge=1, le=4, description="Filter by quarter (1-4)"
    )
    month: Optional[int] = Field(
        None, ge=1, le=12, description="Filter by month (1-12)"
    )
    region_code: Optional[str] = Field(None, description="Filter by region code")
    region_level: Optional[str] = Field(
        None, description="Filter by region level (kunta, seutukunta, maakunta)"
    )
    industry_code: Optional[str] = Field(None, description="Filter by industry code")
    industry_level: Optional[str] = Field(
        None, description="Filter by industry level (section, division, group, class)"
    )
    value_label: Optional[str] = Field(None, description="Filter by value label")
    page: int = Field(1, ge=1, description="Page number for pagination")
    page_size: int = Field(
        100, ge=1, le=1000, description="Number of items per page"
    )


class StatisticAggregation(BaseModel):
    """Schema for aggregated statistic data."""

    dimension_value: str = Field(
        ..., description="The dimension value (year, region, industry)"
    )
    count: int = Field(..., description="Number of data points")
    sum_value: Optional[float] = Field(None, description="Sum of values")
    avg_value: Optional[float] = Field(None, description="Average of values")
    min_value: Optional[float] = Field(None, description="Minimum value")
    max_value: Optional[float] = Field(None, description="Maximum value")


# =============================================================================
# Fetch Configuration Schemas
# =============================================================================


class FetchConfigBase(BaseModel):
    """Base schema for fetch configuration."""

    name: str = Field(..., description="User-friendly name for this fetch configuration")
    description: Optional[str] = Field(
        None, description="Optional description of what data is being fetched"
    )
    is_active: bool = Field(
        True, description="Whether this configuration is enabled for fetching"
    )
    fetch_interval_hours: int = Field(
        24, ge=1, description="Hours between fetch attempts"
    )
    priority: int = Field(
        0, description="Fetch priority for queue ordering (higher = more urgent)"
    )


class FetchConfigCreate(FetchConfigBase):
    """Schema for creating a new fetch configuration."""

    dataset_id: str = Field(..., description="Target dataset identifier for fetching")


class FetchConfigUpdate(BaseModel):
    """Schema for updating fetch configuration.

    All fields are optional to allow partial updates.
    """

    name: Optional[str] = Field(
        None, description="User-friendly name for this fetch configuration"
    )
    description: Optional[str] = Field(
        None, description="Optional description of what data is being fetched"
    )
    is_active: Optional[bool] = Field(
        None, description="Whether this configuration is enabled for fetching"
    )
    fetch_interval_hours: Optional[int] = Field(
        None, ge=1, description="Hours between fetch attempts"
    )
    priority: Optional[int] = Field(
        None, description="Fetch priority for queue ordering (higher = more urgent)"
    )


class FetchConfigResponse(FetchConfigBase):
    """Schema for fetch configuration API response."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Unique identifier for the fetch configuration")
    dataset_id: str = Field(..., description="Target dataset identifier for fetching")
    last_fetch_at: Optional[datetime] = Field(
        None, description="Timestamp of last successful fetch"
    )
    last_fetch_status: str = Field(
        ..., description="Status of the last fetch attempt (success, failed, pending)"
    )
    last_error_message: Optional[str] = Field(
        None, description="Error message from last failed fetch"
    )
    next_fetch_at: Optional[datetime] = Field(
        None, description="Scheduled time for next fetch attempt"
    )
    fetch_count: int = Field(..., description="Total number of successful fetches")
    created_at: datetime = Field(
        ..., description="Timestamp when configuration was created"
    )
    updated_at: datetime = Field(
        ..., description="Timestamp of last configuration update"
    )


class FetchConfigWithDataset(FetchConfigResponse):
    """Schema for fetch configuration response with embedded dataset data."""

    dataset: Optional[DatasetResponse] = Field(
        None, description="Target dataset details"
    )


class FetchConfigListResponse(BaseModel):
    """Schema for paginated fetch configuration list response."""

    items: list[FetchConfigResponse]
    total: int
    page: int
    page_size: int


# =============================================================================
# Common Response Schemas
# =============================================================================


class HealthResponse(BaseModel):
    """Schema for health check endpoint response."""

    status: str = Field(..., description="Service health status")
    database: str = Field(..., description="Database connection status")
    timestamp: datetime = Field(..., description="Health check timestamp")


class ErrorResponse(BaseModel):
    """Schema for API error responses."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    detail: Optional[str] = Field(None, description="Additional error details")


class MessageResponse(BaseModel):
    """Schema for simple message responses."""

    message: str = Field(..., description="Response message")


# =============================================================================
# StatFin API Related Schemas
# =============================================================================


class StatFinTableInfo(BaseModel):
    """Schema for StatFin table metadata."""

    table_id: str = Field(..., description="StatFin table identifier")
    text: str = Field(..., description="Table name/description")
    type: str = Field(..., description="Node type (table, folder)")
    path: list[str] = Field(default_factory=list, description="Path in StatFin hierarchy")


class StatFinTableListResponse(BaseModel):
    """Schema for list of StatFin tables."""

    tables: list[StatFinTableInfo]
    total: int


class StatFinDimensionValue(BaseModel):
    """Schema for a dimension value from StatFin."""

    code: str = Field(..., description="Dimension value code")
    text: str = Field(..., description="Dimension value text/label")


class StatFinDimension(BaseModel):
    """Schema for a dimension from StatFin table metadata."""

    name: str = Field(..., description="Dimension name")
    text: str = Field(..., description="Dimension display text")
    values: list[StatFinDimensionValue] = Field(
        default_factory=list, description="Available dimension values"
    )


class StatFinTableMetadata(BaseModel):
    """Schema for detailed StatFin table metadata."""

    table_id: str = Field(..., description="StatFin table identifier")
    title: str = Field(..., description="Table title")
    dimensions: list[StatFinDimension] = Field(
        default_factory=list, description="Available dimensions"
    )
    last_updated: Optional[str] = Field(None, description="Last update timestamp")
    source: Optional[str] = Field(None, description="Data source information")


# =============================================================================
# Linked Data Schemas
# =============================================================================


class LinkedDataPoint(BaseModel):
    """Schema for a linked data point combining multiple datasets.

    Represents a single data point with values from multiple datasets
    that share the same dimensional coordinates (time, region, industry).
    """

    year: int = Field(..., description="Year of the data point")
    quarter: Optional[int] = Field(
        None, ge=1, le=4, description="Quarter (1-4) for quarterly data"
    )
    month: Optional[int] = Field(
        None, ge=1, le=12, description="Month (1-12) for monthly data"
    )
    region_code: Optional[str] = Field(
        None, description="Region code for geographic dimension"
    )
    industry_code: Optional[str] = Field(
        None, description="Industry code for sector dimension"
    )
    values: dict[str, Optional[float]] = Field(
        ..., description="Values keyed by dataset_id"
    )
    metadata: dict[str, dict[str, Optional[str]]] = Field(
        default_factory=dict,
        description="Metadata (unit, value_label, data_quality) keyed by dataset_id",
    )


class LinkedDataResponse(BaseModel):
    """Schema for linked data API response.

    Returns data from multiple datasets joined on shared dimensions.
    """

    datasets: list[str] = Field(..., description="List of dataset IDs included in the response")
    items: list[LinkedDataPoint] = Field(..., description="Linked data points")
    total: int = Field(..., description="Total number of matching dimension combinations")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")


class DatasetCoverage(BaseModel):
    """Schema for dataset coverage information in linked queries."""

    dataset_id: str = Field(..., description="Dataset identifier")
    name_fi: str = Field(..., description="Finnish name of the dataset")
    data_point_count: int = Field(..., description="Number of data points in the result set")
    year_range: Optional[tuple[int, int]] = Field(
        None, description="Range of years with data (min, max)"
    )
    has_region_dimension: bool = Field(
        False, description="Whether dataset includes region dimension"
    )
    has_industry_dimension: bool = Field(
        False, description="Whether dataset includes industry dimension"
    )
