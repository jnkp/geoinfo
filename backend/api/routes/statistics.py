"""API routes for statistics queries with multi-dimensional filtering.

This module provides FastAPI routes for querying statistics data:
- GET /api/statistics: Query statistics with multi-dimensional filtering
- GET /api/statistics/linked: Query multiple datasets with data linkage
- GET /api/statistics/{statistic_id}: Get a single statistic by ID
- POST /api/statistics: Create a new statistic data point (for data import)
- DELETE /api/statistics/{statistic_id}: Delete a statistic data point

Statistics can be filtered by:
- Time: year, year_from, year_to, quarter, month
- Geography: region_code, region_level
- Industry: industry_code, industry_level
- Value: dataset_id, value_label

All routes use async database sessions and return appropriate HTTP status codes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    ErrorResponse,
    LinkedDataPoint,
    LinkedDataResponse,
    MessageResponse,
    StatisticCreate,
    StatisticListResponse,
    StatisticResponse,
)
from models import Statistic, Dataset, Region, Industry, get_db

router = APIRouter()


@router.get(
    "",
    response_model=StatisticListResponse,
    summary="Query statistics",
    description="Retrieve statistics with multi-dimensional filtering across time, geography, and industry dimensions.",
)
async def list_statistics(
    dataset_id: str | None = Query(None, description="Filter by dataset ID"),
    year: int | None = Query(None, description="Filter by exact year"),
    year_from: int | None = Query(None, description="Filter by minimum year"),
    year_to: int | None = Query(None, description="Filter by maximum year"),
    quarter: int | None = Query(None, ge=1, le=4, description="Filter by quarter (1-4)"),
    month: int | None = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    region_code: str | None = Query(None, description="Filter by region code"),
    region_level: str | None = Query(
        None, description="Filter by region level (kunta, seutukunta, maakunta)"
    ),
    industry_code: str | None = Query(None, description="Filter by industry code"),
    industry_level: str | None = Query(
        None, description="Filter by industry level (section, division, group, class)"
    ),
    value_label: str | None = Query(None, description="Filter by value label"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> StatisticListResponse:
    """Query statistics with multi-dimensional filtering.

    Supports filtering across multiple dimensions:
    - Time: year (exact), year_from/year_to (range), quarter, month
    - Geography: region_code (exact), region_level (filter by administrative level)
    - Industry: industry_code (exact), industry_level (filter by classification level)
    - Dataset: dataset_id, value_label

    Args:
        dataset_id: Filter by dataset ID
        year: Filter by exact year
        year_from: Filter by minimum year (inclusive)
        year_to: Filter by maximum year (inclusive)
        quarter: Filter by quarter (1-4)
        month: Filter by month (1-12)
        region_code: Filter by region code
        region_level: Filter by region administrative level
        industry_code: Filter by industry code
        industry_level: Filter by industry classification level
        value_label: Filter by value label
        page: Page number (1-indexed)
        page_size: Number of items per page (max 1000)
        db: Database session

    Returns:
        StatisticListResponse with paginated statistics list
    """
    # Build filter conditions
    conditions = []

    # Dataset filter
    if dataset_id is not None:
        conditions.append(Statistic.dataset_id == dataset_id)

    # Time dimension filters
    if year is not None:
        conditions.append(Statistic.year == year)
    if year_from is not None:
        conditions.append(Statistic.year >= year_from)
    if year_to is not None:
        conditions.append(Statistic.year <= year_to)
    if quarter is not None:
        conditions.append(Statistic.quarter == quarter)
    if month is not None:
        conditions.append(Statistic.month == month)

    # Geographic dimension filters
    if region_code is not None:
        conditions.append(Statistic.region_code == region_code)
    if region_level is not None:
        # Join with regions table to filter by level
        conditions.append(Region.region_level == region_level)

    # Industry dimension filters
    if industry_code is not None:
        conditions.append(Statistic.industry_code == industry_code)
    if industry_level is not None:
        # Join with industries table to filter by level
        conditions.append(Industry.level == industry_level)

    # Value label filter
    if value_label is not None:
        conditions.append(Statistic.value_label == value_label)

    # Build base query
    base_query = select(Statistic)

    # Add joins if filtering by dimension levels
    if region_level is not None:
        base_query = base_query.join(
            Region, Statistic.region_code == Region.code, isouter=True
        )
    if industry_level is not None:
        base_query = base_query.join(
            Industry, Statistic.industry_code == Industry.code, isouter=True
        )

    # Apply filters
    if conditions:
        base_query = base_query.where(and_(*conditions))

    # Count total matching records
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch paginated results
    offset = (page - 1) * page_size
    query = (
        base_query.order_by(Statistic.year.desc(), Statistic.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    statistics = result.scalars().all()

    return StatisticListResponse(
        items=[StatisticResponse.model_validate(s) for s in statistics],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/linked",
    response_model=LinkedDataResponse,
    summary="Query linked data",
    description="Query multiple datasets with automatic joining on shared dimensions (time, region, industry).",
    responses={
        400: {"model": ErrorResponse, "description": "No datasets specified"},
    },
)
async def get_linked_data(
    datasets: str = Query(
        ...,
        description="Comma-separated list of dataset IDs to query",
        examples=["employment,wages", "dataset_a,dataset_b,dataset_c"],
    ),
    year: int | None = Query(None, description="Filter by exact year"),
    year_from: int | None = Query(None, description="Filter by minimum year"),
    year_to: int | None = Query(None, description="Filter by maximum year"),
    quarter: int | None = Query(None, ge=1, le=4, description="Filter by quarter (1-4)"),
    month: int | None = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    region_code: str | None = Query(None, description="Filter by region code"),
    region_level: str | None = Query(
        None, description="Filter by region level (kunta, seutukunta, maakunta)"
    ),
    industry_code: str | None = Query(None, description="Filter by industry code"),
    industry_level: str | None = Query(
        None, description="Filter by industry level (section, division, group, class)"
    ),
    value_label: str | None = Query(None, description="Filter by value label"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> LinkedDataResponse:
    """Query multiple datasets with data linkage on shared dimensions.

    This endpoint allows querying statistics from multiple datasets at once,
    returning data points that are linked by their shared dimensional coordinates
    (year, quarter, month, region_code, industry_code).

    Data from different datasets that share the same dimensional coordinates
    are combined into a single LinkedDataPoint with values keyed by dataset_id.

    Args:
        datasets: Comma-separated list of dataset IDs to query
        year: Filter by exact year
        year_from: Filter by minimum year (inclusive)
        year_to: Filter by maximum year (inclusive)
        quarter: Filter by quarter (1-4)
        month: Filter by month (1-12)
        region_code: Filter by region code
        region_level: Filter by region administrative level
        industry_code: Filter by industry code
        industry_level: Filter by industry classification level
        value_label: Filter by value label
        page: Page number (1-indexed)
        page_size: Number of items per page (max 1000)
        db: Database session

    Returns:
        LinkedDataResponse with linked data from multiple datasets
    """
    # Parse dataset IDs from comma-separated string
    dataset_ids = [d.strip() for d in datasets.split(",") if d.strip()]

    if not dataset_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid dataset IDs provided. Use comma-separated list of dataset IDs.",
        )

    # Build filter conditions for the query
    conditions = [Statistic.dataset_id.in_(dataset_ids)]

    # Time dimension filters
    if year is not None:
        conditions.append(Statistic.year == year)
    if year_from is not None:
        conditions.append(Statistic.year >= year_from)
    if year_to is not None:
        conditions.append(Statistic.year <= year_to)
    if quarter is not None:
        conditions.append(Statistic.quarter == quarter)
    if month is not None:
        conditions.append(Statistic.month == month)

    # Geographic dimension filters
    if region_code is not None:
        conditions.append(Statistic.region_code == region_code)
    if region_level is not None:
        conditions.append(Region.region_level == region_level)

    # Industry dimension filters
    if industry_code is not None:
        conditions.append(Statistic.industry_code == industry_code)
    if industry_level is not None:
        conditions.append(Industry.level == industry_level)

    # Value label filter
    if value_label is not None:
        conditions.append(Statistic.value_label == value_label)

    # Build base query to get all statistics from requested datasets
    base_query = select(Statistic)

    # Add joins if filtering by dimension levels
    if region_level is not None:
        base_query = base_query.join(
            Region, Statistic.region_code == Region.code, isouter=True
        )
    if industry_level is not None:
        base_query = base_query.join(
            Industry, Statistic.industry_code == Industry.code, isouter=True
        )

    # Apply filters
    base_query = base_query.where(and_(*conditions))

    # Get distinct dimension combinations for pagination
    # Count unique dimension combinations
    dimension_cols = [
        Statistic.year,
        Statistic.quarter,
        Statistic.month,
        Statistic.region_code,
        Statistic.industry_code,
    ]

    distinct_dims_query = (
        select(*dimension_cols)
        .where(and_(*conditions))
        .distinct()
    )

    # Add joins for dimension level filtering in distinct query too
    if region_level is not None:
        distinct_dims_query = distinct_dims_query.join(
            Region, Statistic.region_code == Region.code, isouter=True
        )
    if industry_level is not None:
        distinct_dims_query = distinct_dims_query.join(
            Industry, Statistic.industry_code == Industry.code, isouter=True
        )

    # Count total unique dimension combinations
    count_query = select(func.count()).select_from(distinct_dims_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated dimension combinations
    offset = (page - 1) * page_size
    dims_query = (
        distinct_dims_query
        .order_by(
            Statistic.year.desc(),
            Statistic.quarter.desc().nulls_last(),
            Statistic.month.desc().nulls_last(),
            Statistic.region_code.nulls_last(),
            Statistic.industry_code.nulls_last(),
        )
        .offset(offset)
        .limit(page_size)
    )

    dims_result = await db.execute(dims_query)
    dimension_combos = dims_result.all()

    # If no dimension combinations found, return empty response
    if not dimension_combos:
        return LinkedDataResponse(
            datasets=dataset_ids,
            items=[],
            total=0,
            page=page,
            page_size=page_size,
        )

    # Fetch all statistics that match the dimension combinations
    # Build OR conditions for each dimension combination
    combo_conditions = []
    for combo in dimension_combos:
        year_val, quarter_val, month_val, region_val, industry_val = combo
        combo_cond = [
            Statistic.year == year_val,
            Statistic.dataset_id.in_(dataset_ids),
        ]
        if quarter_val is not None:
            combo_cond.append(Statistic.quarter == quarter_val)
        else:
            combo_cond.append(Statistic.quarter.is_(None))
        if month_val is not None:
            combo_cond.append(Statistic.month == month_val)
        else:
            combo_cond.append(Statistic.month.is_(None))
        if region_val is not None:
            combo_cond.append(Statistic.region_code == region_val)
        else:
            combo_cond.append(Statistic.region_code.is_(None))
        if industry_val is not None:
            combo_cond.append(Statistic.industry_code == industry_val)
        else:
            combo_cond.append(Statistic.industry_code.is_(None))

        combo_conditions.append(and_(*combo_cond))

    stats_query = (
        select(Statistic)
        .where(or_(*combo_conditions))
        .order_by(Statistic.year.desc())
    )
    stats_result = await db.execute(stats_query)
    all_stats = stats_result.scalars().all()

    # Group statistics by dimension combination
    linked_data_map: dict[tuple, LinkedDataPoint] = {}

    for stat in all_stats:
        key = (stat.year, stat.quarter, stat.month, stat.region_code, stat.industry_code)

        if key not in linked_data_map:
            linked_data_map[key] = LinkedDataPoint(
                year=stat.year,
                quarter=stat.quarter,
                month=stat.month,
                region_code=stat.region_code,
                industry_code=stat.industry_code,
                values={},
                metadata={},
            )

        # Add value from this dataset
        linked_data_map[key].values[stat.dataset_id] = stat.value
        linked_data_map[key].metadata[stat.dataset_id] = {
            "unit": stat.unit,
            "value_label": stat.value_label,
            "data_quality": stat.data_quality,
        }

    # Convert to list preserving the order from dimension_combos
    items = []
    for combo in dimension_combos:
        key = tuple(combo)
        if key in linked_data_map:
            items.append(linked_data_map[key])

    return LinkedDataResponse(
        datasets=dataset_ids,
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{statistic_id}",
    response_model=StatisticResponse,
    summary="Get statistic",
    description="Retrieve a single statistic data point by its ID.",
    responses={
        404: {"model": ErrorResponse, "description": "Statistic not found"},
    },
)
async def get_statistic(
    statistic_id: int,
    db: AsyncSession = Depends(get_db),
) -> StatisticResponse:
    """Get a single statistic by ID.

    Args:
        statistic_id: Unique statistic identifier
        db: Database session

    Returns:
        StatisticResponse with statistic details

    Raises:
        HTTPException: 404 if statistic not found
    """
    query = select(Statistic).where(Statistic.id == statistic_id)
    result = await db.execute(query)
    statistic = result.scalar_one_or_none()

    if statistic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Statistic with id '{statistic_id}' not found",
        )

    return StatisticResponse.model_validate(statistic)


@router.post(
    "",
    response_model=StatisticResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create statistic",
    description="Create a new statistic data point. Used for data import from StatFin.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid data"},
        404: {"model": ErrorResponse, "description": "Dataset not found"},
    },
)
async def create_statistic(
    statistic_data: StatisticCreate,
    db: AsyncSession = Depends(get_db),
) -> StatisticResponse:
    """Create a new statistic data point.

    Args:
        statistic_data: Statistic creation data
        db: Database session

    Returns:
        StatisticResponse with created statistic details

    Raises:
        HTTPException: 404 if dataset not found
    """
    # Verify dataset exists
    dataset_query = select(Dataset).where(Dataset.id == statistic_data.dataset_id)
    dataset_result = await db.execute(dataset_query)
    if dataset_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with id '{statistic_data.dataset_id}' not found",
        )

    # Create new statistic
    statistic = Statistic(**statistic_data.model_dump())
    db.add(statistic)
    await db.flush()
    await db.refresh(statistic)

    return StatisticResponse.model_validate(statistic)


@router.delete(
    "/{statistic_id}",
    response_model=MessageResponse,
    summary="Delete statistic",
    description="Delete a single statistic data point by its ID.",
    responses={
        404: {"model": ErrorResponse, "description": "Statistic not found"},
    },
)
async def delete_statistic(
    statistic_id: int,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Delete a statistic by ID.

    Args:
        statistic_id: Unique statistic identifier
        db: Database session

    Returns:
        MessageResponse confirming deletion

    Raises:
        HTTPException: 404 if statistic not found
    """
    query = select(Statistic).where(Statistic.id == statistic_id)
    result = await db.execute(query)
    statistic = result.scalar_one_or_none()

    if statistic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Statistic with id '{statistic_id}' not found",
        )

    await db.delete(statistic)
    await db.flush()

    return MessageResponse(message=f"Statistic with id '{statistic_id}' deleted successfully")
