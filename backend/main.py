"""FastAPI application entry point for the Finnish Statistics platform.

This module provides:
- FastAPI application instance with CORS middleware
- OpenAPI documentation at /docs and /redoc
- Database lifecycle management (init/close)
- Health check endpoint
- API router registration

Run with:
    uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from models.database import init_db, close_db
from api.routes import datasets_router, dimensions_router, fetch_router, statfin_router, statistics_router

# Load settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup and shutdown events.

    On startup:
        - Initialize database connection pool
        - Create tables if they don't exist (dev mode)

    On shutdown:
        - Close database connection pool
    """
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


# Create FastAPI application
app = FastAPI(
    title="Finnish Statistics API",
    description="""
    API for collecting, storing, and visualizing Finnish public statistics
    from the StatFin database.

    ## Features

    - **Datasets**: Manage dataset configurations and metadata
    - **Statistics**: Query statistics with multi-dimensional filtering
      (time, region, industry)
    - **Dimensions**: Access region and industry reference data
    - **Fetch Configuration**: Configure automated data fetching schedules
    - **StatFin Integration**: Browse and import data from Statistics Finland

    ## Dimensions

    Statistics can be filtered across multiple dimensions:
    - **Time**: Year, quarter, month
    - **Geography**: Maakunta (region), seutukunta, kunta (municipality)
    - **Industry**: TOL 2008 industry classification

    Data is stored with consistent dimension keys enabling easy linkage
    across different datasets.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Configure CORS middleware
# Allow requests from frontend development server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """Root endpoint returning API information.

    Returns:
        dict: Basic API information with links to documentation.
    """
    return {
        "name": "Finnish Statistics API",
        "version": "1.0.0",
        "documentation": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint for monitoring and container orchestration.

    Returns:
        dict: Health status of the API.
    """
    return {"status": "healthy"}


# Register API routers
app.include_router(datasets_router, prefix="/api/datasets", tags=["datasets"])
app.include_router(statistics_router, prefix="/api/statistics", tags=["statistics"])
app.include_router(dimensions_router, prefix="/api", tags=["dimensions"])
app.include_router(fetch_router, prefix="/api/fetch-configs", tags=["fetch"])
app.include_router(statfin_router, prefix="/api/statfin", tags=["statfin"])
