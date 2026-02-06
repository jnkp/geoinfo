"""API routes for fetch configuration CRUD operations and StatFin API integration.

This module provides FastAPI routes for managing fetch configurations:
- GET /api/fetch-configs: List all fetch configurations with pagination
- GET /api/fetch-configs/{config_id}: Get a single fetch configuration by ID
- POST /api/fetch-configs: Create a new fetch configuration
- PATCH /api/fetch-configs/{config_id}: Update fetch configuration
- DELETE /api/fetch-configs/{config_id}: Delete a fetch configuration

And StatFin API browsing endpoints:
- GET /api/statfin/tables: Browse available StatFin tables

All routes use async database sessions and return appropriate HTTP status codes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    ErrorResponse,
    FetchConfigCreate,
    FetchConfigListResponse,
    FetchConfigResponse,
    FetchConfigUpdate,
    MessageResponse,
    StatFinTableInfo,
    StatFinTableListResponse,
)
from models import Dataset, FetchConfig, get_db
from services.statfin import StatFinClient, StatFinError

router = APIRouter()

# Separate router for StatFin API endpoints
statfin_router = APIRouter()


@router.get(
    "",
    response_model=FetchConfigListResponse,
    summary="List fetch configurations",
    description="Retrieve a paginated list of all fetch configurations.",
)
async def list_fetch_configs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
) -> FetchConfigListResponse:
    """List all fetch configurations with pagination.

    Args:
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
        is_active: Optional filter for active/inactive configurations
        db: Database session

    Returns:
        FetchConfigListResponse with paginated fetch configuration list
    """
    # Build base query with optional filter
    base_query = select(FetchConfig)
    if is_active is not None:
        base_query = base_query.where(FetchConfig.is_active == is_active)

    # Count total configurations
    count_query = select(func.count(FetchConfig.id)).select_from(
        base_query.subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch paginated configurations
    offset = (page - 1) * page_size
    query = base_query.order_by(FetchConfig.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    configs = result.scalars().all()

    return FetchConfigListResponse(
        items=[FetchConfigResponse.model_validate(c) for c in configs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{config_id}",
    response_model=FetchConfigResponse,
    summary="Get fetch configuration",
    description="Retrieve a single fetch configuration by its ID.",
    responses={
        404: {"model": ErrorResponse, "description": "Fetch configuration not found"},
    },
)
async def get_fetch_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
) -> FetchConfigResponse:
    """Get a single fetch configuration by ID.

    Args:
        config_id: Unique fetch configuration identifier
        db: Database session

    Returns:
        FetchConfigResponse with configuration details

    Raises:
        HTTPException: 404 if fetch configuration not found
    """
    query = select(FetchConfig).where(FetchConfig.id == config_id)
    result = await db.execute(query)
    config = result.scalar_one_or_none()

    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fetch configuration with id '{config_id}' not found",
        )

    return FetchConfigResponse.model_validate(config)


@router.post(
    "",
    response_model=FetchConfigResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create fetch configuration",
    description="Create a new fetch configuration for a dataset.",
    responses={
        404: {"model": ErrorResponse, "description": "Dataset not found"},
        409: {"model": ErrorResponse, "description": "Fetch configuration already exists for dataset"},
    },
)
async def create_fetch_config(
    config_data: FetchConfigCreate,
    db: AsyncSession = Depends(get_db),
) -> FetchConfigResponse:
    """Create a new fetch configuration.

    Args:
        config_data: Fetch configuration creation data
        db: Database session

    Returns:
        FetchConfigResponse with created configuration details

    Raises:
        HTTPException: 404 if dataset not found
        HTTPException: 409 if fetch configuration already exists for dataset
    """
    # Check if dataset exists
    dataset_query = select(Dataset).where(Dataset.id == config_data.dataset_id)
    dataset_result = await db.execute(dataset_query)
    if dataset_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with id '{config_data.dataset_id}' not found",
        )

    # Check if fetch configuration already exists for this dataset
    existing_query = select(FetchConfig).where(
        FetchConfig.dataset_id == config_data.dataset_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Fetch configuration already exists for dataset '{config_data.dataset_id}'",
        )

    # Create new fetch configuration
    config = FetchConfig(**config_data.model_dump())
    db.add(config)
    await db.flush()
    await db.refresh(config)

    return FetchConfigResponse.model_validate(config)


@router.patch(
    "/{config_id}",
    response_model=FetchConfigResponse,
    summary="Update fetch configuration",
    description="Update an existing fetch configuration. Only provided fields are updated.",
    responses={
        404: {"model": ErrorResponse, "description": "Fetch configuration not found"},
    },
)
async def update_fetch_config(
    config_id: int,
    config_data: FetchConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> FetchConfigResponse:
    """Update fetch configuration.

    Args:
        config_id: Unique fetch configuration identifier
        config_data: Fields to update (partial update supported)
        db: Database session

    Returns:
        FetchConfigResponse with updated configuration details

    Raises:
        HTTPException: 404 if fetch configuration not found
    """
    query = select(FetchConfig).where(FetchConfig.id == config_id)
    result = await db.execute(query)
    config = result.scalar_one_or_none()

    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fetch configuration with id '{config_id}' not found",
        )

    # Update only provided fields
    update_data = config_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.flush()
    await db.refresh(config)

    return FetchConfigResponse.model_validate(config)


@router.delete(
    "/{config_id}",
    response_model=MessageResponse,
    summary="Delete fetch configuration",
    description="Delete a fetch configuration.",
    responses={
        404: {"model": ErrorResponse, "description": "Fetch configuration not found"},
    },
)
async def delete_fetch_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Delete a fetch configuration.

    Args:
        config_id: Unique fetch configuration identifier
        db: Database session

    Returns:
        MessageResponse confirming deletion

    Raises:
        HTTPException: 404 if fetch configuration not found
    """
    query = select(FetchConfig).where(FetchConfig.id == config_id)
    result = await db.execute(query)
    config = result.scalar_one_or_none()

    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fetch configuration with id '{config_id}' not found",
        )

    await db.delete(config)

    return MessageResponse(message=f"Fetch configuration '{config_id}' deleted successfully")


# =============================================================================
# StatFin API Browsing Endpoints
# =============================================================================


@statfin_router.get(
    "/tables",
    response_model=StatFinTableListResponse,
    summary="List available StatFin tables",
    description="Browse available tables from the StatFin PxWeb API. "
    "Use the 'path' parameter to navigate the hierarchy.",
    responses={
        500: {"model": ErrorResponse, "description": "StatFin API error"},
    },
)
async def list_statfin_tables(
    path: str = Query("", description="Path in the StatFin hierarchy (empty for root)"),
) -> StatFinTableListResponse:
    """List available tables and folders from the StatFin API.

    This endpoint allows browsing the StatFin table hierarchy. The StatFin
    database organizes tables in a tree structure with folders and tables.

    Args:
        path: Path in the hierarchy (e.g., "" for root, "vaerak" for demographics)

    Returns:
        StatFinTableListResponse with list of tables/folders at the specified path

    Raises:
        HTTPException: 500 if StatFin API request fails
    """
    client = StatFinClient()
    try:
        async with client:
            items = await client.list_tables(path)

            tables = [
                StatFinTableInfo(
                    table_id=item.id,
                    text=item.text,
                    type="table" if item.is_table else "folder",
                    path=item.path,
                )
                for item in items
            ]

            return StatFinTableListResponse(
                tables=tables,
                total=len(tables),
            )
    except StatFinError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tables from StatFin API: {e.message}",
        )
