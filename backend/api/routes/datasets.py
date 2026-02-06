"""API routes for dataset CRUD operations.

This module provides FastAPI routes for managing dataset metadata:
- GET /api/datasets: List all datasets with pagination
- GET /api/datasets/{dataset_id}: Get a single dataset by ID
- POST /api/datasets: Create a new dataset
- PATCH /api/datasets/{dataset_id}: Update dataset metadata
- DELETE /api/datasets/{dataset_id}: Delete a dataset

All routes use async database sessions and return appropriate HTTP status codes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    DatasetCreate,
    DatasetListResponse,
    DatasetResponse,
    DatasetUpdate,
    ErrorResponse,
    MessageResponse,
)
from models import Dataset, get_db

router = APIRouter()


@router.get(
    "",
    response_model=DatasetListResponse,
    summary="List datasets",
    description="Retrieve a paginated list of all configured datasets.",
)
async def list_datasets(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> DatasetListResponse:
    """List all datasets with pagination.

    Args:
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
        db: Database session

    Returns:
        DatasetListResponse with paginated dataset list
    """
    # Count total datasets
    count_query = select(func.count(Dataset.id))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch paginated datasets
    offset = (page - 1) * page_size
    query = select(Dataset).order_by(Dataset.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    datasets = result.scalars().all()

    return DatasetListResponse(
        items=[DatasetResponse.model_validate(d) for d in datasets],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{dataset_id}",
    response_model=DatasetResponse,
    summary="Get dataset",
    description="Retrieve a single dataset by its ID.",
    responses={
        404: {"model": ErrorResponse, "description": "Dataset not found"},
    },
)
async def get_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
) -> DatasetResponse:
    """Get a single dataset by ID.

    Args:
        dataset_id: Unique dataset identifier
        db: Database session

    Returns:
        DatasetResponse with dataset details

    Raises:
        HTTPException: 404 if dataset not found
    """
    query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(query)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with id '{dataset_id}' not found",
        )

    return DatasetResponse.model_validate(dataset)


@router.post(
    "",
    response_model=DatasetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create dataset",
    description="Create a new dataset with the provided metadata.",
    responses={
        409: {"model": ErrorResponse, "description": "Dataset already exists"},
    },
)
async def create_dataset(
    dataset_data: DatasetCreate,
    db: AsyncSession = Depends(get_db),
) -> DatasetResponse:
    """Create a new dataset.

    Args:
        dataset_data: Dataset creation data
        db: Database session

    Returns:
        DatasetResponse with created dataset details

    Raises:
        HTTPException: 409 if dataset with same ID already exists
    """
    # Check if dataset with same ID already exists
    existing_query = select(Dataset).where(Dataset.id == dataset_data.id)
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset with id '{dataset_data.id}' already exists",
        )

    # Check if dataset with same statfin_table_id already exists
    existing_statfin_query = select(Dataset).where(
        Dataset.statfin_table_id == dataset_data.statfin_table_id
    )
    existing_statfin_result = await db.execute(existing_statfin_query)
    if existing_statfin_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Dataset with statfin_table_id '{dataset_data.statfin_table_id}' already exists",
        )

    # Create new dataset
    dataset = Dataset(**dataset_data.model_dump())
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)

    return DatasetResponse.model_validate(dataset)


@router.patch(
    "/{dataset_id}",
    response_model=DatasetResponse,
    summary="Update dataset",
    description="Update an existing dataset's metadata. Only provided fields are updated.",
    responses={
        404: {"model": ErrorResponse, "description": "Dataset not found"},
    },
)
async def update_dataset(
    dataset_id: str,
    dataset_data: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
) -> DatasetResponse:
    """Update dataset metadata.

    Args:
        dataset_id: Unique dataset identifier
        dataset_data: Fields to update (partial update supported)
        db: Database session

    Returns:
        DatasetResponse with updated dataset details

    Raises:
        HTTPException: 404 if dataset not found
    """
    query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(query)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with id '{dataset_id}' not found",
        )

    # Update only provided fields
    update_data = dataset_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dataset, field, value)

    await db.flush()
    await db.refresh(dataset)

    return DatasetResponse.model_validate(dataset)


@router.delete(
    "/{dataset_id}",
    response_model=MessageResponse,
    summary="Delete dataset",
    description="Delete a dataset and all its associated data.",
    responses={
        404: {"model": ErrorResponse, "description": "Dataset not found"},
    },
)
async def delete_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Delete a dataset.

    Args:
        dataset_id: Unique dataset identifier
        db: Database session

    Returns:
        MessageResponse confirming deletion

    Raises:
        HTTPException: 404 if dataset not found
    """
    query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(query)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with id '{dataset_id}' not found",
        )

    await db.delete(dataset)

    return MessageResponse(message=f"Dataset '{dataset_id}' deleted successfully")
