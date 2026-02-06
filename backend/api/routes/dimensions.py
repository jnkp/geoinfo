"""API routes for dimension lookups (regions and industries).

This module provides FastAPI routes for querying dimension reference data:
- GET /api/regions: List regions with optional filtering by level
- GET /api/regions/{code}: Get a single region by code
- GET /api/industries: List industries with optional filtering by level
- GET /api/industries/{code}: Get a single industry by code

Dimensions can be filtered by:
- level: Region administrative level (kunta, seutukunta, maakunta) or
         Industry classification level (section, division, group, class)
- parent_code: Filter by parent for hierarchy traversal

All routes use async database sessions and return appropriate HTTP status codes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    ErrorResponse,
    IndustryListResponse,
    IndustryResponse,
    RegionListResponse,
    RegionResponse,
)
from models import Industry, Region, get_db

router = APIRouter()


# =============================================================================
# Region Routes
# =============================================================================


@router.get(
    "/regions",
    response_model=RegionListResponse,
    summary="List regions",
    description="Retrieve regions with optional filtering by administrative level or parent.",
)
async def list_regions(
    region_level: str | None = Query(
        None, description="Filter by administrative level (kunta, seutukunta, maakunta)"
    ),
    parent_code: str | None = Query(
        None, description="Filter by parent region code for hierarchy traversal"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> RegionListResponse:
    """List all regions with optional filtering.

    Supports filtering by:
    - region_level: Filter by administrative level (kunta, seutukunta, maakunta)
    - parent_code: Filter by parent region code for hierarchy traversal

    Args:
        region_level: Filter by administrative level
        parent_code: Filter by parent region code
        page: Page number (1-indexed)
        page_size: Number of items per page (max 1000)
        db: Database session

    Returns:
        RegionListResponse with paginated region list
    """
    # Build filter conditions
    conditions = []

    if region_level is not None:
        conditions.append(Region.region_level == region_level)
    if parent_code is not None:
        conditions.append(Region.parent_code == parent_code)

    # Build base query
    base_query = select(Region)

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
        base_query.order_by(Region.region_level, Region.code)
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    regions = result.scalars().all()

    return RegionListResponse(
        items=[RegionResponse.model_validate(r) for r in regions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/regions/{code}",
    response_model=RegionResponse,
    summary="Get region",
    description="Retrieve a single region by its code.",
    responses={
        404: {"model": ErrorResponse, "description": "Region not found"},
    },
)
async def get_region(
    code: str,
    db: AsyncSession = Depends(get_db),
) -> RegionResponse:
    """Get a single region by code.

    Args:
        code: Statistics Finland official region code
        db: Database session

    Returns:
        RegionResponse with region details

    Raises:
        HTTPException: 404 if region not found
    """
    query = select(Region).where(Region.code == code)
    result = await db.execute(query)
    region = result.scalar_one_or_none()

    if region is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Region with code '{code}' not found",
        )

    return RegionResponse.model_validate(region)


# =============================================================================
# Industry Routes
# =============================================================================


@router.get(
    "/industries",
    response_model=IndustryListResponse,
    summary="List industries",
    description="Retrieve industries with optional filtering by classification level or parent.",
)
async def list_industries(
    level: str | None = Query(
        None, description="Filter by classification level (section, division, group, class)"
    ),
    parent_code: str | None = Query(
        None, description="Filter by parent industry code for hierarchy traversal"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> IndustryListResponse:
    """List all industries with optional filtering.

    Supports filtering by:
    - level: Filter by classification level (section, division, group, class)
    - parent_code: Filter by parent industry code for hierarchy traversal

    Args:
        level: Filter by classification level
        parent_code: Filter by parent industry code
        page: Page number (1-indexed)
        page_size: Number of items per page (max 1000)
        db: Database session

    Returns:
        IndustryListResponse with paginated industry list
    """
    # Build filter conditions
    conditions = []

    if level is not None:
        conditions.append(Industry.level == level)
    if parent_code is not None:
        conditions.append(Industry.parent_code == parent_code)

    # Build base query
    base_query = select(Industry)

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
        base_query.order_by(Industry.level, Industry.code)
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    industries = result.scalars().all()

    return IndustryListResponse(
        items=[IndustryResponse.model_validate(i) for i in industries],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/industries/{code}",
    response_model=IndustryResponse,
    summary="Get industry",
    description="Retrieve a single industry by its code.",
    responses={
        404: {"model": ErrorResponse, "description": "Industry not found"},
    },
)
async def get_industry(
    code: str,
    db: AsyncSession = Depends(get_db),
) -> IndustryResponse:
    """Get a single industry by code.

    Args:
        code: TOL 2008 industry code
        db: Database session

    Returns:
        IndustryResponse with industry details

    Raises:
        HTTPException: 404 if industry not found
    """
    query = select(Industry).where(Industry.code == code)
    result = await db.execute(query)
    industry = result.scalar_one_or_none()

    if industry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Industry with code '{code}' not found",
        )

    return IndustryResponse.model_validate(industry)
