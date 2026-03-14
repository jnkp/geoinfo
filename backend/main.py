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
import traceback
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

# Set debug mode from settings
app.state.debug = settings.debug

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
    expose_headers=["X-Request-ID"],  # Expose request ID header to clients
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Middleware to generate and attach unique request ID to each request.

    The request ID is:
    - Stored in request.state.request_id for use in handlers and error logging
    - Added to response headers as X-Request-ID for client-side tracking

    Args:
        request: The incoming request
        call_next: Function to call the next middleware/handler

    Returns:
        Response with X-Request-ID header
    """
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler with debug-aware stack traces.

    Handles all uncaught exceptions and returns a consistent error response.
    In debug mode, includes stack traces and exception type information.

    Args:
        request: The incoming request
        exc: The exception that was raised

    Returns:
        JSONResponse with error details, request ID, and optional stack trace
    """
    request_id = getattr(request.state, "request_id", "unknown")
    error_detail = {
        "error": str(exc),
        "request_id": request_id,
    }

    # Only include stack trace in debug mode
    if app.state.debug:
        error_detail["stack_trace"] = traceback.format_exc()
        error_detail["type"] = type(exc).__name__

    return JSONResponse(
        status_code=500,
        content=error_detail,
        headers={"X-Request-ID": request_id},
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
async def health_check(request: Request) -> dict:
    """Health check endpoint for monitoring and container orchestration.

    In debug mode, includes additional diagnostic information such as:
    - Debug mode status
    - Database configuration
    - Environment settings

    Args:
        request: The incoming request (used to access app state)

    Returns:
        dict: Health status and optional debug diagnostics.
    """
    response = {"status": "healthy"}

    # Include debug diagnostics in debug mode
    if app.state.debug:
        response["debug"] = {
            "debug_mode": True,
            "database_url": settings.database_url.split("@")[-1] if "@" in settings.database_url else "***",
            "cors_origins": app.middleware_stack.__dict__.get("app", app).__dict__.get("user_middleware", []),
            "environment": settings.environment if hasattr(settings, "environment") else "unknown",
        }

    return response


# Register API routers
app.include_router(datasets_router, prefix="/api/datasets", tags=["datasets"])
app.include_router(statistics_router, prefix="/api/statistics", tags=["statistics"])
app.include_router(dimensions_router, prefix="/api", tags=["dimensions"])
app.include_router(fetch_router, prefix="/api/fetch-configs", tags=["fetch"])
app.include_router(statfin_router, prefix="/api/statfin", tags=["statfin"])
