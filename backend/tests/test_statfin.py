"""Unit tests for StatFin API client."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from services.statfin import (
    StatFinError,
    StatFinRateLimitError,
    StatFinTableInfo,
    StatFinDimensionValue,
    StatFinDimension,
    StatFinTableMetadata,
    StatFinCategory,
    StatFinParsedDimension,
    StatFinDataPoint,
    StatFinDataset,
    StatFinClient,
)


class TestStatFinError:
    """Tests for StatFinError exception class."""

    def test_error_with_status_code(self):
        """Test error string with status code."""
        error = StatFinError(
            message="Test error",
            status_code=404,
            response_body="Not found",
        )
        assert str(error) == "StatFin API error (404): Test error"

    def test_error_without_status_code(self):
        """Test error string without status code."""
        error = StatFinError(message="Connection failed")
        assert str(error) == "StatFin API error: Connection failed"

    def test_error_attributes(self):
        """Test error attributes are set correctly."""
        error = StatFinError(
            message="Test",
            status_code=500,
            response_body="Server error",
        )
        assert error.message == "Test"
        assert error.status_code == 500
        assert error.response_body == "Server error"


class TestStatFinRateLimitError:
    """Tests for StatFinRateLimitError exception class."""

    def test_rate_limit_error_with_retry_after(self):
        """Test rate limit error with retry_after."""
        error = StatFinRateLimitError(
            message="Rate limited",
            status_code=429,
            retry_after=60,
        )
        assert error.retry_after == 60
        assert str(error) == "StatFin API error (429): Rate limited"


class TestStatFinTableInfo:
    """Tests for StatFinTableInfo data class."""

    def test_is_table_true(self):
        """Test is_table returns True for table type."""
        info = StatFinTableInfo(
            id="test.px",
            text="Test Table",
            type="t",
            path=["folder", "test.px"],
        )
        assert info.is_table is True
        assert info.is_folder is False

    def test_is_folder_true(self):
        """Test is_folder returns True for folder type."""
        info = StatFinTableInfo(
            id="folder",
            text="Test Folder",
            type="l",
            path=["folder"],
        )
        assert info.is_table is False
        assert info.is_folder is True

    def test_default_path(self):
        """Test default path is empty list."""
        info = StatFinTableInfo(id="test", text="Test", type="l")
        assert info.path == []


class TestStatFinDimensionValue:
    """Tests for StatFinDimensionValue data class."""

    def test_dimension_value_creation(self):
        """Test dimension value creation."""
        value = StatFinDimensionValue(code="SSS", text="Koko maa")
        assert value.code == "SSS"
        assert value.text == "Koko maa"


class TestStatFinDimension:
    """Tests for StatFinDimension data class."""

    def test_dimension_creation(self):
        """Test dimension creation with all attributes."""
        dim = StatFinDimension(
            name="Alue",
            text="Alue",
            values=[StatFinDimensionValue(code="SSS", text="Koko maa")],
            elimination=True,
            time=False,
        )
        assert dim.name == "Alue"
        assert dim.text == "Alue"
        assert len(dim.values) == 1
        assert dim.elimination is True
        assert dim.time is False

    def test_dimension_defaults(self):
        """Test dimension default values."""
        dim = StatFinDimension(name="Vuosi", text="Year")
        assert dim.values == []
        assert dim.elimination is False
        assert dim.time is False


class TestStatFinTableMetadata:
    """Tests for StatFinTableMetadata data class."""

    def test_metadata_creation(self):
        """Test metadata creation."""
        metadata = StatFinTableMetadata(
            table_id="test/table.px",
            title="Test Table",
            dimensions=[],
            last_updated="2024-01-01",
            source="Test Source",
        )
        assert metadata.table_id == "test/table.px"
        assert metadata.title == "Test Table"
        assert metadata.last_updated == "2024-01-01"
        assert metadata.source == "Test Source"


class TestStatFinCategory:
    """Tests for StatFinCategory data class."""

    def test_category_creation(self):
        """Test category creation."""
        cat = StatFinCategory(index=0, code="SSS", label="Koko maa")
        assert cat.index == 0
        assert cat.code == "SSS"
        assert cat.label == "Koko maa"


class TestStatFinParsedDimension:
    """Tests for StatFinParsedDimension data class."""

    def test_get_category_by_code_found(self, sample_dimension):
        """Test getting category by code when exists."""
        cat = sample_dimension.get_category_by_code("MK01")
        assert cat is not None
        assert cat.code == "MK01"
        assert cat.label == "Uusimaa"

    def test_get_category_by_code_not_found(self, sample_dimension):
        """Test getting category by code when not exists."""
        cat = sample_dimension.get_category_by_code("INVALID")
        assert cat is None

    def test_get_category_by_index_found(self, sample_dimension):
        """Test getting category by index when exists."""
        cat = sample_dimension.get_category_by_index(1)
        assert cat is not None
        assert cat.code == "MK01"

    def test_get_category_by_index_out_of_range(self, sample_dimension):
        """Test getting category by index when out of range."""
        assert sample_dimension.get_category_by_index(-1) is None
        assert sample_dimension.get_category_by_index(100) is None


class TestStatFinDataPoint:
    """Tests for StatFinDataPoint data class."""

    def test_data_point_with_value(self):
        """Test data point with valid value."""
        dp = StatFinDataPoint(
            value=100.5,
            coordinates={"Alue": "SSS", "Vuosi": "2023"},
            labels={"Alue": "Koko maa", "Vuosi": "2023"},
        )
        assert dp.value == 100.5
        assert dp.is_missing is False

    def test_data_point_with_missing_value(self):
        """Test data point with missing value."""
        dp = StatFinDataPoint(
            value=None,
            coordinates={"Alue": "SSS"},
            labels={"Alue": "Koko maa"},
        )
        assert dp.value is None
        assert dp.is_missing is True


class TestStatFinDataset:
    """Tests for StatFinDataset data class."""

    def test_dimension_count(self, sample_dataset):
        """Test dimension_count property."""
        assert sample_dataset.dimension_count == 2

    def test_total_cells(self, sample_dataset):
        """Test total_cells property."""
        assert sample_dataset.total_cells == 6

    def test_get_dimension_found(self, sample_dataset):
        """Test get_dimension when dimension exists."""
        dim = sample_dataset.get_dimension("Alue")
        assert dim is not None
        assert dim.id == "Alue"

    def test_get_dimension_not_found(self, sample_dataset):
        """Test get_dimension when dimension does not exist."""
        dim = sample_dataset.get_dimension("NotExists")
        assert dim is None

    def test_get_data_points(self, sample_dataset):
        """Test get_data_points returns correct data."""
        points = sample_dataset.get_data_points()
        assert len(points) == 6

        # Check first data point
        first = points[0]
        assert first.value == 100.0
        assert "Alue" in first.coordinates
        assert "Vuosi" in first.coordinates

    def test_to_records(self, sample_dataset):
        """Test to_records conversion."""
        records = sample_dataset.to_records()
        assert len(records) == 6

        # Each record should have dimension codes and value
        for record in records:
            assert "Alue" in record
            assert "Vuosi" in record
            assert "value" in record

    def test_to_records_with_labels(self, sample_dataset):
        """Test to_records_with_labels conversion."""
        records = sample_dataset.to_records_with_labels()
        assert len(records) == 6

        # Each record should have both codes and labels
        for record in records:
            assert "Alue_code" in record
            assert "Alue_label" in record
            assert "Vuosi_code" in record
            assert "Vuosi_label" in record
            assert "value" in record


class TestStatFinClientInit:
    """Tests for StatFinClient initialization."""

    def test_client_init_with_defaults(self, mock_settings):
        """Test client initialization with default settings."""
        with patch("services.statfin.get_settings", return_value=mock_settings):
            client = StatFinClient()
            assert client.base_url == "https://test.api.example.com/StatFin"
            assert client.timeout == 30.0
            assert client.max_retries == 3

    def test_client_init_with_custom_url(self, mock_settings):
        """Test client initialization with custom base URL."""
        with patch("services.statfin.get_settings", return_value=mock_settings):
            client = StatFinClient(base_url="https://custom.api.com/")
            assert client.base_url == "https://custom.api.com"

    def test_client_init_with_custom_timeout(self, mock_settings):
        """Test client initialization with custom timeout."""
        with patch("services.statfin.get_settings", return_value=mock_settings):
            client = StatFinClient(timeout=60.0)
            assert client.timeout == 60.0

    def test_client_init_with_custom_retries(self, mock_settings):
        """Test client initialization with custom max retries."""
        with patch("services.statfin.get_settings", return_value=mock_settings):
            client = StatFinClient(max_retries=5)
            assert client.max_retries == 5


class TestStatFinClientBuildQuery:
    """Tests for StatFinClient.build_query method."""

    def test_build_query_with_specific_values(self, statfin_client):
        """Test building query with specific dimension values."""
        query = statfin_client.build_query({
            "Vuosi": ["2022", "2023"],
            "Alue": ["SSS"],
        })

        assert "query" in query
        assert "response" in query
        assert query["response"]["format"] == "json-stat2"

        # Check dimension queries
        query_parts = {q["code"]: q for q in query["query"]}
        assert query_parts["Vuosi"]["selection"]["filter"] == "item"
        assert query_parts["Vuosi"]["selection"]["values"] == ["2022", "2023"]
        assert query_parts["Alue"]["selection"]["filter"] == "item"
        assert query_parts["Alue"]["selection"]["values"] == ["SSS"]

    def test_build_query_with_wildcard(self, statfin_client):
        """Test building query with wildcard for all values."""
        query = statfin_client.build_query({
            "Tiedot": ["*"],
        })

        query_parts = {q["code"]: q for q in query["query"]}
        assert query_parts["Tiedot"]["selection"]["filter"] == "all"
        assert query_parts["Tiedot"]["selection"]["values"] == ["*"]

    def test_build_query_custom_format(self, statfin_client):
        """Test building query with custom response format."""
        query = statfin_client.build_query(
            {"Vuosi": ["2023"]},
            response_format="csv",
        )
        assert query["response"]["format"] == "csv"


class TestStatFinClientParseJsonstat:
    """Tests for StatFinClient.parse_jsonstat method."""

    def test_parse_valid_jsonstat(self, sample_jsonstat_response):
        """Test parsing a valid JSON-stat response."""
        dataset = StatFinClient.parse_jsonstat(sample_jsonstat_response)

        assert dataset.label == "Väestö 31.12."
        assert dataset.source == "Statistics Finland"
        assert dataset.updated == "2024-01-15T08:00:00Z"
        assert dataset.dimension_count == 3
        assert dataset.total_cells == 4

    def test_parse_jsonstat_dimensions(self, sample_jsonstat_response):
        """Test dimension parsing in JSON-stat response."""
        dataset = StatFinClient.parse_jsonstat(sample_jsonstat_response)

        alue_dim = dataset.get_dimension("Alue")
        assert alue_dim is not None
        assert len(alue_dim.categories) == 2
        assert alue_dim.get_category_by_code("SSS").label == "Koko maa"

    def test_parse_jsonstat_with_missing_values(self, sample_jsonstat_with_missing):
        """Test parsing JSON-stat with missing (null) values."""
        dataset = StatFinClient.parse_jsonstat(sample_jsonstat_with_missing)

        data_points = dataset.get_data_points()
        assert len(data_points) == 4

        # Second value should be None
        missing_points = [dp for dp in data_points if dp.is_missing]
        assert len(missing_points) == 1

    def test_parse_jsonstat_invalid_response(self):
        """Test parsing invalid JSON-stat response raises error."""
        with pytest.raises(StatFinError) as exc_info:
            StatFinClient.parse_jsonstat({"invalid": "data"})

        assert "missing required fields" in str(exc_info.value)


class TestStatFinClientAsync:
    """Async tests for StatFinClient methods."""

    @pytest.mark.asyncio
    async def test_context_manager(self, statfin_client):
        """Test client can be used as async context manager."""
        async with statfin_client as client:
            assert client._client is not None

        # Client should be closed after exiting context
        assert statfin_client._client is None

    @pytest.mark.asyncio
    async def test_list_tables(self, statfin_client, sample_list_response):
        """Test list_tables method."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_list_response

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            tables = await statfin_client.list_tables()

        assert len(tables) == 3
        assert tables[0].id == "vaerak"
        assert tables[0].is_folder is True
        assert tables[1].is_table is True

    @pytest.mark.asyncio
    async def test_list_tables_with_path(self, statfin_client, sample_list_response):
        """Test list_tables with specified path."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_list_response

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            tables = await statfin_client.list_tables("vaerak")

        mock_client.get.assert_called_once()
        called_url = mock_client.get.call_args[0][0]
        assert "vaerak" in called_url

    @pytest.mark.asyncio
    async def test_get_table_metadata(self, statfin_client, sample_metadata_response):
        """Test get_table_metadata method."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_metadata_response

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            metadata = await statfin_client.get_table_metadata("vaerak/test.px")

        assert metadata.title == "Väestö iän ja sukupuolen mukaan"
        assert metadata.source == "Statistics Finland"
        assert len(metadata.dimensions) == 3
        assert metadata.dimensions[0].name == "Alue"
        assert len(metadata.dimensions[0].values) == 3

    @pytest.mark.asyncio
    async def test_fetch_table(self, statfin_client, sample_jsonstat_response):
        """Test fetch_table method."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_jsonstat_response

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        query = statfin_client.build_query({"Vuosi": ["2023"]})

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            result = await statfin_client.fetch_table("vaerak/test.px", query)

        assert result == sample_jsonstat_response
        mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_fetch_and_parse(self, statfin_client, sample_jsonstat_response):
        """Test fetch_and_parse convenience method."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_jsonstat_response

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        query = statfin_client.build_query({"Vuosi": ["2023"]})

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            dataset = await statfin_client.fetch_and_parse("vaerak/test.px", query)

        assert isinstance(dataset, StatFinDataset)
        assert dataset.label == "Väestö 31.12."

    @pytest.mark.asyncio
    async def test_request_rate_limit_error(self, statfin_client):
        """Test handling of 429 rate limit response."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "30"}
        mock_response.text = "Too many requests"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        # Set max_retries to 0 to immediately raise error
        statfin_client.max_retries = 0

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            with pytest.raises(StatFinRateLimitError) as exc_info:
                await statfin_client.list_tables()

        assert exc_info.value.status_code == 429
        assert exc_info.value.retry_after == 30

    @pytest.mark.asyncio
    async def test_request_server_error_exhausts_retries(self, statfin_client):
        """Test server error exhausts retries then raises."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        statfin_client.max_retries = 1

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(StatFinError) as exc_info:
                    await statfin_client.list_tables()

        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_request_client_error_no_retry(self, statfin_client):
        """Test client errors (4xx) do not retry."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Not Found"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            with pytest.raises(StatFinError) as exc_info:
                await statfin_client.list_tables()

        assert exc_info.value.status_code == 404
        # Should only be called once (no retries for client errors)
        assert mock_client.get.call_count == 1

    @pytest.mark.asyncio
    async def test_request_timeout_retries(self, statfin_client):
        """Test timeout errors trigger retries."""
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client.is_closed = False

        statfin_client.max_retries = 2

        with patch.object(
            statfin_client, "_ensure_client", return_value=mock_client
        ):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(StatFinError) as exc_info:
                    await statfin_client.list_tables()

        # Should retry max_retries + 1 times
        assert mock_client.get.call_count == 3
        assert "failed after" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_close_idempotent(self, statfin_client):
        """Test close() can be called multiple times safely."""
        # First call
        await statfin_client.close()
        assert statfin_client._client is None

        # Second call should not raise
        await statfin_client.close()
        assert statfin_client._client is None
