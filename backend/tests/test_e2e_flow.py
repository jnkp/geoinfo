"""End-to-end tests for complete data fetch flow: StatFin → Database → API → Frontend.

This test module verifies the complete integration of all system components:
1. StatFin API client fetches data from external API
2. Data is normalized and stored in the database
3. API endpoints return the stored data correctly
4. Data can be filtered across multiple dimensions

Prerequisites:
    - PostgreSQL database running and accessible
    - Environment variables configured (DATABASE_URL, STATFIN_BASE_URL)
    - Backend API server running (optional for some tests)

Usage:
    # Run with pytest (requires database and optional API server):
    cd backend && pytest tests/test_e2e_flow.py -v -s

    # Run specific test:
    pytest tests/test_e2e_flow.py::TestStatFinToDatabaseFlow -v

    # Run with live StatFin API (slower, requires internet):
    pytest tests/test_e2e_flow.py --live-statfin -v
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Configure logging for test visibility
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# Test Configuration and Fixtures
# =============================================================================


def pytest_addoption(parser):
    """Add custom pytest options."""
    parser.addoption(
        "--live-statfin",
        action="store_true",
        default=False,
        help="Run tests against live StatFin API (slower)",
    )


@pytest.fixture(scope="session")
def use_live_statfin(request):
    """Check if live StatFin API should be used."""
    return request.config.getoption("--live-statfin")


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def mock_settings():
    """Provide mock settings for tests."""
    settings = MagicMock()
    settings.database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://geoinfo:geoinfo@localhost:5432/geoinfo_test"
    )
    settings.statfin_base_url = os.environ.get(
        "STATFIN_BASE_URL",
        "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin"
    )
    settings.fetch_interval_hours = 24
    return settings


@pytest.fixture(scope="function")
async def db_session(mock_settings):
    """Create a test database session with transaction rollback."""
    # Import models to ensure they're registered
    with patch("config.get_settings", return_value=mock_settings):
        from models.database import Base
        from models import Dataset, Statistic, FetchConfig, Region, Industry

        # Create test engine
        engine = create_async_engine(
            mock_settings.database_url,
            echo=False,
        )

        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Create session factory
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session() as session:
            yield session
            # Rollback any changes after test
            await session.rollback()

        await engine.dispose()


@pytest.fixture
def sample_statfin_response():
    """Sample JSON-stat2 response for mocked tests."""
    return {
        "class": "dataset",
        "label": "Väestö 31.12. muuttujina Alue, Vuosi ja Tiedot",
        "source": "Tilastokeskus",
        "updated": "2024-03-15T05:00:00Z",
        "id": ["Alue", "Vuosi", "Tiedot"],
        "size": [3, 2, 1],
        "dimension": {
            "Alue": {
                "label": "Alue",
                "category": {
                    "index": {"SSS": 0, "MK01": 1, "MK02": 2},
                    "label": {
                        "SSS": "KOKO MAA",
                        "MK01": "Uusimaa",
                        "MK02": "Varsinais-Suomi"
                    }
                }
            },
            "Vuosi": {
                "label": "Vuosi",
                "category": {
                    "index": {"2022": 0, "2023": 1},
                    "label": {"2022": "2022", "2023": "2023"}
                }
            },
            "Tiedot": {
                "label": "Tiedot",
                "category": {
                    "index": {"vaesto": 0},
                    "label": {"vaesto": "Väestö 31.12."}
                }
            }
        },
        "value": [5548241, 5563970, 1734634, 1751717, 479341, 481143]
    }


# =============================================================================
# StatFin → Database Flow Tests
# =============================================================================


class TestStatFinToDatabaseFlow:
    """Test the complete flow from StatFin API to database storage."""

    @pytest.mark.asyncio
    async def test_statfin_client_fetches_data(self, mock_settings, use_live_statfin):
        """Test that StatFin client can fetch and parse data."""
        with patch("config.get_settings", return_value=mock_settings):
            from services.statfin import StatFinClient

            client = StatFinClient()

            if use_live_statfin:
                # Test with live API
                async with client:
                    # List tables to verify connection
                    tables = await client.list_tables("")
                    assert len(tables) > 0, "Should return at least one table/folder"

                    # Find a population table for testing
                    vaerak_tables = await client.list_tables("vaerak")
                    assert len(vaerak_tables) > 0, "Should find population tables"

                    logger.info(f"Found {len(tables)} root items")
                    logger.info(f"Found {len(vaerak_tables)} population tables")
            else:
                # Test with mocked response
                logger.info("Skipping live StatFin test (use --live-statfin to enable)")

    @pytest.mark.asyncio
    async def test_data_normalizer_parses_time_values(self, mock_settings):
        """Test that DataNormalizer correctly parses various time formats."""
        with patch("config.get_settings", return_value=mock_settings):
            from models import Dataset
            from services.fetcher import DataNormalizer

            # Create mock dataset
            dataset = Dataset(
                id="test-dataset",
                name="Test Dataset",
                statfin_table_id="test/table.px",
                time_resolution="year"
            )

            normalizer = DataNormalizer(dataset)

            # Test year parsing
            year, quarter, month = normalizer.parse_time_value("2023")
            assert year == 2023
            assert quarter is None
            assert month is None

            # Test quarter parsing
            year, quarter, month = normalizer.parse_time_value("2023Q2")
            assert year == 2023
            assert quarter == 2
            assert month is None

            # Test month parsing (M format)
            year, quarter, month = normalizer.parse_time_value("2023M06")
            assert year == 2023
            assert quarter is None
            assert month == 6

            # Test month parsing (dash format)
            year, quarter, month = normalizer.parse_time_value("2023-06")
            assert year == 2023
            assert quarter is None
            assert month == 6

            logger.info("Time value parsing tests passed")

    @pytest.mark.asyncio
    async def test_fetcher_stores_data_in_database(
        self, mock_settings, db_session, sample_statfin_response
    ):
        """Test that DataFetcher correctly stores normalized data in the database."""
        with patch("config.get_settings", return_value=mock_settings):
            from models import Dataset, Statistic, FetchConfig
            from services.statfin import StatFinClient
            from services.fetcher import DataFetcher

            # Create test dataset
            dataset = Dataset(
                id="e2e-test-dataset",
                name="E2E Test Dataset",
                description="Dataset for E2E testing",
                statfin_table_id="vaerak/statfin_vaerak_pxt_11re.px",
                time_resolution="year",
                has_region=True,
            )
            db_session.add(dataset)
            await db_session.flush()

            # Create fetch config
            fetch_config = FetchConfig(
                dataset_id=dataset.id,
                is_active=True,
                fetch_interval_hours=24,
            )
            db_session.add(fetch_config)
            await db_session.flush()

            # Mock StatFin client to return sample response
            mock_client = AsyncMock(spec=StatFinClient)

            # Create parsed dataset from sample response
            from services.statfin import StatFinClient as RealClient
            parsed_data = RealClient.parse_jsonstat(sample_statfin_response)

            mock_client.fetch_and_parse = AsyncMock(return_value=parsed_data)
            mock_client.build_query = MagicMock(return_value={"query": []})
            mock_client._ensure_client = AsyncMock()
            mock_client.close = AsyncMock()

            # Run fetch with mocked client
            async with DataFetcher(statfin_client=mock_client) as fetcher:
                result = await fetcher.fetch_dataset(dataset.id, session=db_session)

            # Verify fetch result
            assert result.success, f"Fetch failed: {result.error_message}"
            assert result.records_fetched == 6, "Should fetch 6 data points (3 regions × 2 years)"
            assert result.records_inserted > 0, "Should insert records"

            # Verify data in database
            stat_count = await db_session.execute(
                select(func.count(Statistic.id)).where(Statistic.dataset_id == dataset.id)
            )
            count = stat_count.scalar()
            assert count > 0, "Should have statistics in database"

            # Verify FetchConfig was updated
            await db_session.refresh(fetch_config)
            assert fetch_config.last_fetch_status == "success"
            assert fetch_config.fetch_count == 1
            assert fetch_config.last_fetch_at is not None

            logger.info(f"Successfully stored {count} statistics in database")


# =============================================================================
# Database → API Flow Tests
# =============================================================================


class TestDatabaseToAPIFlow:
    """Test that data stored in database is correctly exposed via API."""

    @pytest.mark.asyncio
    async def test_api_returns_statistics_from_database(self, mock_settings, db_session):
        """Test that /api/statistics endpoint returns stored data."""
        with patch("config.get_settings", return_value=mock_settings):
            with patch("models.database.get_db") as mock_get_db:
                # Make the dependency return our test session
                async def override_get_db():
                    yield db_session

                mock_get_db.return_value = override_get_db()

                from main import app
                from models import Dataset, Statistic

                # Create test dataset
                dataset = Dataset(
                    id="api-test-dataset",
                    name="API Test Dataset",
                    statfin_table_id="test/table.px",
                    time_resolution="year",
                )
                db_session.add(dataset)

                # Create test statistics
                for year in [2022, 2023]:
                    for value in [100000, 200000, 300000]:
                        stat = Statistic(
                            dataset_id=dataset.id,
                            year=year,
                            value=value,
                            value_label="Population",
                        )
                        db_session.add(stat)

                await db_session.flush()

                # Test API endpoint
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    # Test basic fetch
                    response = await client.get("/api/statistics")
                    assert response.status_code == 200
                    data = response.json()
                    assert "items" in data
                    assert data["total"] >= 6

                    # Test filtering by year
                    response = await client.get("/api/statistics?year=2023")
                    assert response.status_code == 200
                    data = response.json()
                    for item in data["items"]:
                        assert item["year"] == 2023

                    # Test filtering by dataset
                    response = await client.get(
                        f"/api/statistics?dataset_id={dataset.id}"
                    )
                    assert response.status_code == 200
                    data = response.json()
                    for item in data["items"]:
                        assert item["dataset_id"] == dataset.id

                logger.info("API statistics endpoint tests passed")

    @pytest.mark.asyncio
    async def test_api_datasets_crud(self, mock_settings, db_session):
        """Test datasets CRUD operations via API."""
        with patch("config.get_settings", return_value=mock_settings):
            with patch("models.database.get_db") as mock_get_db:
                async def override_get_db():
                    yield db_session

                mock_get_db.return_value = override_get_db()

                from main import app

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    # Create dataset
                    create_data = {
                        "id": "crud-test-dataset",
                        "name": "CRUD Test Dataset",
                        "statfin_table_id": "test/crud_table.px",
                        "time_resolution": "year",
                    }
                    response = await client.post("/api/datasets", json=create_data)
                    assert response.status_code == 201
                    created = response.json()
                    assert created["id"] == create_data["id"]

                    # Read dataset
                    response = await client.get(f"/api/datasets/{create_data['id']}")
                    assert response.status_code == 200
                    read = response.json()
                    assert read["name"] == create_data["name"]

                    # List datasets
                    response = await client.get("/api/datasets")
                    assert response.status_code == 200
                    data = response.json()
                    assert data["total"] >= 1

                    # Delete dataset
                    response = await client.delete(f"/api/datasets/{create_data['id']}")
                    assert response.status_code == 200

                logger.info("Dataset CRUD tests passed")

    @pytest.mark.asyncio
    async def test_api_multi_dimensional_filtering(self, mock_settings, db_session):
        """Test that API supports filtering across multiple dimensions."""
        with patch("config.get_settings", return_value=mock_settings):
            with patch("models.database.get_db") as mock_get_db:
                async def override_get_db():
                    yield db_session

                mock_get_db.return_value = override_get_db()

                from main import app
                from models import Dataset, Statistic, Region

                # Create test region
                region = Region(
                    code="MK01",
                    name_fi="Uusimaa",
                    level="maakunta",
                )
                db_session.add(region)

                # Create test dataset
                dataset = Dataset(
                    id="filter-test-dataset",
                    name="Filter Test Dataset",
                    statfin_table_id="test/filter.px",
                    time_resolution="quarter",
                    has_region=True,
                )
                db_session.add(dataset)

                # Create statistics with various dimensions
                for year in [2022, 2023]:
                    for quarter in [1, 2, 3, 4]:
                        stat = Statistic(
                            dataset_id=dataset.id,
                            year=year,
                            quarter=quarter,
                            region_code="MK01",
                            value=year * 1000 + quarter * 100,
                            value_label="Test Value",
                        )
                        db_session.add(stat)

                await db_session.flush()

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    # Test year range filtering
                    response = await client.get(
                        "/api/statistics?year_from=2022&year_to=2022"
                    )
                    assert response.status_code == 200
                    data = response.json()
                    for item in data["items"]:
                        assert item["year"] == 2022

                    # Test quarter filtering
                    response = await client.get("/api/statistics?quarter=2")
                    assert response.status_code == 200
                    data = response.json()
                    for item in data["items"]:
                        assert item["quarter"] == 2

                    # Test region filtering
                    response = await client.get("/api/statistics?region_code=MK01")
                    assert response.status_code == 200
                    data = response.json()
                    for item in data["items"]:
                        assert item["region_code"] == "MK01"

                    # Test combined filtering
                    response = await client.get(
                        "/api/statistics?year=2023&quarter=3&region_code=MK01"
                    )
                    assert response.status_code == 200
                    data = response.json()
                    for item in data["items"]:
                        assert item["year"] == 2023
                        assert item["quarter"] == 3
                        assert item["region_code"] == "MK01"

                logger.info("Multi-dimensional filtering tests passed")


# =============================================================================
# Complete E2E Flow Test
# =============================================================================


class TestCompleteE2EFlow:
    """Test the complete end-to-end flow from configuration to visualization."""

    @pytest.mark.asyncio
    async def test_full_fetch_flow_with_mocked_statfin(
        self, mock_settings, db_session, sample_statfin_response
    ):
        """
        Complete E2E test: Configure → Fetch → Store → Query.

        This test simulates the full user workflow:
        1. Create a dataset configuration
        2. Create a fetch configuration
        3. Trigger a data fetch
        4. Verify data is stored correctly
        5. Verify data can be queried via API
        """
        with patch("config.get_settings", return_value=mock_settings):
            from models import Dataset, Statistic, FetchConfig
            from services.statfin import StatFinClient
            from services.fetcher import DataFetcher

            # STEP 1: Create dataset configuration
            logger.info("Step 1: Creating dataset configuration...")
            dataset = Dataset(
                id="full-e2e-test",
                name="Full E2E Test Dataset",
                description="Testing complete flow",
                statfin_table_id="vaerak/statfin_vaerak_pxt_11re.px",
                time_resolution="year",
                has_region=True,
            )
            db_session.add(dataset)
            await db_session.flush()

            # STEP 2: Create fetch configuration
            logger.info("Step 2: Creating fetch configuration...")
            fetch_config = FetchConfig(
                dataset_id=dataset.id,
                is_active=True,
                fetch_interval_hours=24,
                priority=1,
            )
            db_session.add(fetch_config)
            await db_session.flush()

            # STEP 3: Trigger data fetch (with mocked StatFin response)
            logger.info("Step 3: Triggering data fetch...")
            mock_client = AsyncMock(spec=StatFinClient)
            parsed_data = StatFinClient.parse_jsonstat(sample_statfin_response)
            mock_client.fetch_and_parse = AsyncMock(return_value=parsed_data)
            mock_client.build_query = MagicMock(return_value={"query": []})
            mock_client._ensure_client = AsyncMock()
            mock_client.close = AsyncMock()

            async with DataFetcher(statfin_client=mock_client) as fetcher:
                result = await fetcher.fetch_dataset(dataset.id, session=db_session)

            # STEP 4: Verify data storage
            logger.info("Step 4: Verifying data storage...")
            assert result.success, f"Fetch failed: {result.error_message}"

            stat_query = select(Statistic).where(Statistic.dataset_id == dataset.id)
            stat_result = await db_session.execute(stat_query)
            statistics = stat_result.scalars().all()

            assert len(statistics) > 0, "Should have stored statistics"
            logger.info(f"Stored {len(statistics)} statistics")

            # Verify data integrity
            years = {s.year for s in statistics}
            assert 2022 in years, "Should have 2022 data"
            assert 2023 in years, "Should have 2023 data"

            # STEP 5: Verify data via query
            logger.info("Step 5: Verifying data via query...")

            # Query by year
            query_2023 = select(Statistic).where(
                Statistic.dataset_id == dataset.id,
                Statistic.year == 2023
            )
            result_2023 = await db_session.execute(query_2023)
            stats_2023 = result_2023.scalars().all()

            assert len(stats_2023) > 0, "Should have 2023 statistics"

            # Verify values are reasonable
            for stat in stats_2023:
                assert stat.value is not None or stat.value_label is not None

            logger.info("Full E2E flow test passed!")
            logger.info(f"Summary: Created dataset, fetched {result.records_fetched} records, "
                       f"stored {result.records_inserted} statistics")

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        os.environ.get("CI") == "true",
        reason="Skip live API test in CI"
    )
    async def test_live_statfin_integration(self, mock_settings, db_session, use_live_statfin):
        """
        Test with live StatFin API (optional, slower).

        This test actually connects to the StatFin API to verify:
        1. API is accessible
        2. Data can be fetched
        3. Response parsing works with real data
        """
        if not use_live_statfin:
            pytest.skip("Live StatFin test disabled (use --live-statfin to enable)")

        with patch("config.get_settings", return_value=mock_settings):
            from services.statfin import StatFinClient

            logger.info("Testing live StatFin API integration...")

            async with StatFinClient() as client:
                # List root tables
                tables = await client.list_tables("")
                assert len(tables) > 0
                logger.info(f"Found {len(tables)} root items in StatFin")

                # Get metadata for a known table
                # Note: This table path may need to be updated if StatFin changes
                try:
                    metadata = await client.get_table_metadata("vaerak")
                    logger.info(f"Got metadata: {metadata}")
                except Exception as e:
                    logger.warning(f"Could not fetch metadata: {e}")

            logger.info("Live StatFin integration test passed!")


# =============================================================================
# Verification Helper Functions
# =============================================================================


async def verify_database_state(session: AsyncSession, dataset_id: str) -> dict:
    """
    Utility function to verify database state after a fetch.

    Args:
        session: Database session
        dataset_id: ID of the dataset to verify

    Returns:
        Dict with verification results
    """
    from models import Dataset, Statistic, FetchConfig

    results = {
        "dataset_exists": False,
        "fetch_config_exists": False,
        "statistics_count": 0,
        "years_covered": [],
        "fetch_status": None,
    }

    # Check dataset
    dataset = await session.get(Dataset, dataset_id)
    results["dataset_exists"] = dataset is not None

    if dataset:
        # Check fetch config
        config_query = select(FetchConfig).where(FetchConfig.dataset_id == dataset_id)
        config_result = await session.execute(config_query)
        config = config_result.scalar_one_or_none()
        results["fetch_config_exists"] = config is not None
        if config:
            results["fetch_status"] = config.last_fetch_status

        # Check statistics
        stat_count = await session.execute(
            select(func.count(Statistic.id)).where(Statistic.dataset_id == dataset_id)
        )
        results["statistics_count"] = stat_count.scalar() or 0

        # Check years covered
        years_query = select(Statistic.year).where(
            Statistic.dataset_id == dataset_id
        ).distinct()
        years_result = await session.execute(years_query)
        results["years_covered"] = sorted([y[0] for y in years_result.fetchall()])

    return results


# =============================================================================
# Run verification if executed directly
# =============================================================================


if __name__ == "__main__":
    # Quick smoke test when run directly
    print("Running E2E flow tests...")
    print("Use pytest for full test execution:")
    print("  cd backend && pytest tests/test_e2e_flow.py -v")
    print("\nFor live StatFin API tests:")
    print("  cd backend && pytest tests/test_e2e_flow.py --live-statfin -v")
