"""Unit tests for database models."""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch

# We need to mock the settings before importing models
# since database.py imports settings at module level
mock_settings = MagicMock()
mock_settings.async_database_url = "postgresql+asyncpg://test:test@localhost/test"
mock_settings.debug = False

with patch("config.get_settings", return_value=mock_settings):
    from models.dimensions import Region, Industry
    from models.statistics import Dataset, Statistic
    from models.fetch_config import FetchConfig


class TestRegion:
    """Tests for Region model."""

    def test_region_creation(self):
        """Test creating a Region with all attributes."""
        region = Region(
            code="091",
            name_fi="Helsinki",
            name_sv="Helsingfors",
            name_en="Helsinki",
            region_level="kunta",
            parent_code="011",
        )
        assert region.code == "091"
        assert region.name_fi == "Helsinki"
        assert region.name_sv == "Helsingfors"
        assert region.name_en == "Helsinki"
        assert region.region_level == "kunta"
        assert region.parent_code == "011"

    def test_region_creation_minimal(self):
        """Test creating a Region with only required attributes."""
        region = Region(
            code="01",
            name_fi="Uusimaa",
            region_level="maakunta",
        )
        assert region.code == "01"
        assert region.name_fi == "Uusimaa"
        assert region.region_level == "maakunta"
        assert region.name_sv is None
        assert region.name_en is None
        assert region.parent_code is None
        assert region.geometry_json is None

    def test_region_with_geometry(self):
        """Test Region with geometry_json attribute."""
        geojson = '{"type": "Polygon", "coordinates": [[[0,0],[1,0],[1,1],[0,0]]]}'
        region = Region(
            code="091",
            name_fi="Helsinki",
            region_level="kunta",
            geometry_json=geojson,
        )
        assert region.geometry_json == geojson

    def test_region_repr(self):
        """Test Region string representation."""
        region = Region(
            code="091",
            name_fi="Helsinki",
            region_level="kunta",
        )
        repr_str = repr(region)
        assert "Region" in repr_str
        assert "091" in repr_str
        assert "Helsinki" in repr_str
        assert "kunta" in repr_str

    def test_region_tablename(self):
        """Test Region table name."""
        assert Region.__tablename__ == "regions"


class TestIndustry:
    """Tests for Industry model."""

    def test_industry_creation(self):
        """Test creating an Industry with all attributes."""
        industry = Industry(
            code="A",
            name_fi="Maatalous, metsätalous ja kalatalous",
            name_sv="Jordbruk, skogsbruk och fiske",
            name_en="Agriculture, forestry and fishing",
            level="section",
            parent_code=None,
            description="This section includes farming and forestry activities.",
        )
        assert industry.code == "A"
        assert industry.name_fi == "Maatalous, metsätalous ja kalatalous"
        assert industry.name_sv == "Jordbruk, skogsbruk och fiske"
        assert industry.name_en == "Agriculture, forestry and fishing"
        assert industry.level == "section"
        assert industry.parent_code is None
        assert industry.description == "This section includes farming and forestry activities."

    def test_industry_creation_minimal(self):
        """Test creating an Industry with only required attributes."""
        industry = Industry(
            code="01",
            name_fi="Kasvinviljely ja kotieläintalous",
            level="division",
        )
        assert industry.code == "01"
        assert industry.name_fi == "Kasvinviljely ja kotieläintalous"
        assert industry.level == "division"
        assert industry.name_sv is None
        assert industry.name_en is None
        assert industry.parent_code is None
        assert industry.description is None

    def test_industry_hierarchy(self):
        """Test Industry with parent-child relationship."""
        industry = Industry(
            code="011",
            name_fi="Yksivuotisten kasvien viljely",
            level="group",
            parent_code="01",
        )
        assert industry.code == "011"
        assert industry.level == "group"
        assert industry.parent_code == "01"

    def test_industry_repr(self):
        """Test Industry string representation."""
        industry = Industry(
            code="A",
            name_fi="Maatalous",
            level="section",
        )
        repr_str = repr(industry)
        assert "Industry" in repr_str
        assert "A" in repr_str
        assert "Maatalous" in repr_str
        assert "section" in repr_str

    def test_industry_tablename(self):
        """Test Industry table name."""
        assert Industry.__tablename__ == "industries"


class TestDataset:
    """Tests for Dataset model."""

    def test_dataset_creation(self):
        """Test creating a Dataset with all attributes."""
        now = datetime.utcnow()
        dataset = Dataset(
            id="population_by_region",
            statfin_table_id="statfin_vaerak_pxt_11re",
            name_fi="Väestö alueittain",
            name_sv="Befolkning efter region",
            name_en="Population by region",
            description="Population data by Finnish regions",
            source_url="https://statfin.stat.fi/PxWeb/pxweb/fi/StatFin/",
            time_resolution="year",
            has_region_dimension=True,
            has_industry_dimension=False,
            created_at=now,
            updated_at=now,
        )
        assert dataset.id == "population_by_region"
        assert dataset.statfin_table_id == "statfin_vaerak_pxt_11re"
        assert dataset.name_fi == "Väestö alueittain"
        assert dataset.name_sv == "Befolkning efter region"
        assert dataset.name_en == "Population by region"
        assert dataset.description == "Population data by Finnish regions"
        assert dataset.source_url == "https://statfin.stat.fi/PxWeb/pxweb/fi/StatFin/"
        assert dataset.time_resolution == "year"
        assert dataset.has_region_dimension is True
        assert dataset.has_industry_dimension is False

    def test_dataset_creation_minimal(self):
        """Test creating a Dataset with only required attributes."""
        dataset = Dataset(
            id="test_dataset",
            statfin_table_id="statfin_test_pxt_001",
            name_fi="Testi",
        )
        assert dataset.id == "test_dataset"
        assert dataset.statfin_table_id == "statfin_test_pxt_001"
        assert dataset.name_fi == "Testi"
        assert dataset.name_sv is None
        assert dataset.name_en is None
        assert dataset.description is None
        assert dataset.source_url is None

    def test_dataset_default_time_resolution(self):
        """Test Dataset default time resolution is 'year'."""
        dataset = Dataset(
            id="test",
            statfin_table_id="test_table",
            name_fi="Test",
        )
        assert dataset.time_resolution == "year"

    def test_dataset_default_dimension_flags(self):
        """Test Dataset default dimension flags are False."""
        dataset = Dataset(
            id="test",
            statfin_table_id="test_table",
            name_fi="Test",
        )
        assert dataset.has_region_dimension is False
        assert dataset.has_industry_dimension is False

    def test_dataset_quarterly_resolution(self):
        """Test Dataset with quarterly time resolution."""
        dataset = Dataset(
            id="quarterly_data",
            statfin_table_id="statfin_quarterly",
            name_fi="Neljännesvuosittainen data",
            time_resolution="quarter",
        )
        assert dataset.time_resolution == "quarter"

    def test_dataset_monthly_resolution(self):
        """Test Dataset with monthly time resolution."""
        dataset = Dataset(
            id="monthly_data",
            statfin_table_id="statfin_monthly",
            name_fi="Kuukausittainen data",
            time_resolution="month",
        )
        assert dataset.time_resolution == "month"

    def test_dataset_repr(self):
        """Test Dataset string representation."""
        dataset = Dataset(
            id="pop_by_region",
            statfin_table_id="statfin_vaerak",
            name_fi="Väestö",
        )
        repr_str = repr(dataset)
        assert "Dataset" in repr_str
        assert "pop_by_region" in repr_str
        assert "Väestö" in repr_str
        assert "statfin_vaerak" in repr_str

    def test_dataset_tablename(self):
        """Test Dataset table name."""
        assert Dataset.__tablename__ == "datasets"


class TestStatistic:
    """Tests for Statistic model."""

    def test_statistic_creation(self):
        """Test creating a Statistic with all attributes."""
        now = datetime.utcnow()
        statistic = Statistic(
            id=1,
            dataset_id="population_data",
            year=2023,
            quarter=1,
            month=3,
            region_code="091",
            industry_code="A",
            value=100000.5,
            value_label="Väestö",
            unit="persons",
            data_quality="final",
            fetched_at=now,
        )
        assert statistic.id == 1
        assert statistic.dataset_id == "population_data"
        assert statistic.year == 2023
        assert statistic.quarter == 1
        assert statistic.month == 3
        assert statistic.region_code == "091"
        assert statistic.industry_code == "A"
        assert statistic.value == 100000.5
        assert statistic.value_label == "Väestö"
        assert statistic.unit == "persons"
        assert statistic.data_quality == "final"

    def test_statistic_creation_minimal(self):
        """Test creating a Statistic with only required attributes."""
        statistic = Statistic(
            dataset_id="test_data",
            year=2023,
        )
        assert statistic.dataset_id == "test_data"
        assert statistic.year == 2023
        assert statistic.quarter is None
        assert statistic.month is None
        assert statistic.region_code is None
        assert statistic.industry_code is None
        assert statistic.value is None
        assert statistic.value_label is None
        assert statistic.unit is None
        assert statistic.data_quality is None

    def test_statistic_with_missing_value(self):
        """Test Statistic with null value (missing data)."""
        statistic = Statistic(
            dataset_id="test_data",
            year=2023,
            region_code="091",
            value=None,
        )
        assert statistic.value is None

    def test_statistic_yearly_data(self):
        """Test Statistic for yearly data (no quarter/month)."""
        statistic = Statistic(
            dataset_id="yearly_pop",
            year=2023,
            region_code="01",
            value=1500000,
        )
        assert statistic.year == 2023
        assert statistic.quarter is None
        assert statistic.month is None

    def test_statistic_quarterly_data(self):
        """Test Statistic for quarterly data."""
        statistic = Statistic(
            dataset_id="quarterly_gdp",
            year=2023,
            quarter=2,
            value=50000.0,
        )
        assert statistic.year == 2023
        assert statistic.quarter == 2
        assert statistic.month is None

    def test_statistic_monthly_data(self):
        """Test Statistic for monthly data."""
        statistic = Statistic(
            dataset_id="monthly_employment",
            year=2023,
            month=6,
            value=2500000,
        )
        assert statistic.year == 2023
        assert statistic.quarter is None
        assert statistic.month == 6

    def test_statistic_data_quality_options(self):
        """Test Statistic with different data quality values."""
        for quality in ["final", "preliminary", "estimate"]:
            statistic = Statistic(
                dataset_id="test",
                year=2023,
                data_quality=quality,
            )
            assert statistic.data_quality == quality

    def test_statistic_repr(self):
        """Test Statistic string representation."""
        statistic = Statistic(
            id=42,
            dataset_id="pop_data",
            year=2023,
            region_code="091",
            value=650000.0,
        )
        repr_str = repr(statistic)
        assert "Statistic" in repr_str
        assert "42" in repr_str
        assert "pop_data" in repr_str
        assert "2023" in repr_str
        assert "091" in repr_str
        assert "650000" in repr_str

    def test_statistic_tablename(self):
        """Test Statistic table name."""
        assert Statistic.__tablename__ == "statistics"


class TestFetchConfig:
    """Tests for FetchConfig model."""

    def test_fetch_config_creation(self):
        """Test creating a FetchConfig with all attributes."""
        now = datetime.utcnow()
        next_fetch = datetime(2024, 1, 16, 8, 0, 0)
        config = FetchConfig(
            id=1,
            dataset_id="population_data",
            name="Population Data Fetch",
            description="Daily fetch of population statistics",
            is_active=True,
            fetch_interval_hours=24,
            priority=5,
            last_fetch_at=now,
            last_fetch_status="success",
            last_error_message=None,
            next_fetch_at=next_fetch,
            fetch_count=100,
            created_at=now,
            updated_at=now,
        )
        assert config.id == 1
        assert config.dataset_id == "population_data"
        assert config.name == "Population Data Fetch"
        assert config.description == "Daily fetch of population statistics"
        assert config.is_active is True
        assert config.fetch_interval_hours == 24
        assert config.priority == 5
        assert config.last_fetch_at == now
        assert config.last_fetch_status == "success"
        assert config.last_error_message is None
        assert config.next_fetch_at == next_fetch
        assert config.fetch_count == 100

    def test_fetch_config_creation_minimal(self):
        """Test creating a FetchConfig with only required attributes."""
        config = FetchConfig(
            dataset_id="test_dataset",
            name="Test Fetch",
        )
        assert config.dataset_id == "test_dataset"
        assert config.name == "Test Fetch"
        assert config.description is None
        assert config.last_fetch_at is None
        assert config.last_error_message is None
        assert config.next_fetch_at is None

    def test_fetch_config_default_is_active(self):
        """Test FetchConfig default is_active is True."""
        config = FetchConfig(
            dataset_id="test",
            name="Test",
        )
        assert config.is_active is True

    def test_fetch_config_default_interval(self):
        """Test FetchConfig default fetch_interval_hours is 24."""
        config = FetchConfig(
            dataset_id="test",
            name="Test",
        )
        assert config.fetch_interval_hours == 24

    def test_fetch_config_default_priority(self):
        """Test FetchConfig default priority is 0."""
        config = FetchConfig(
            dataset_id="test",
            name="Test",
        )
        assert config.priority == 0

    def test_fetch_config_default_fetch_count(self):
        """Test FetchConfig default fetch_count is 0."""
        config = FetchConfig(
            dataset_id="test",
            name="Test",
        )
        assert config.fetch_count == 0

    def test_fetch_config_default_status(self):
        """Test FetchConfig default last_fetch_status is 'pending'."""
        config = FetchConfig(
            dataset_id="test",
            name="Test",
        )
        assert config.last_fetch_status == "pending"

    def test_fetch_config_status_options(self):
        """Test FetchConfig with different status values."""
        for status in ["pending", "success", "failed"]:
            config = FetchConfig(
                dataset_id="test",
                name="Test",
                last_fetch_status=status,
            )
            assert config.last_fetch_status == status

    def test_fetch_config_inactive(self):
        """Test FetchConfig when set to inactive."""
        config = FetchConfig(
            dataset_id="test",
            name="Disabled Fetch",
            is_active=False,
        )
        assert config.is_active is False

    def test_fetch_config_with_error(self):
        """Test FetchConfig with failed status and error message."""
        config = FetchConfig(
            dataset_id="test",
            name="Failed Fetch",
            last_fetch_status="failed",
            last_error_message="Connection timeout after 30 seconds",
        )
        assert config.last_fetch_status == "failed"
        assert config.last_error_message == "Connection timeout after 30 seconds"

    def test_fetch_config_custom_interval(self):
        """Test FetchConfig with custom fetch interval."""
        config = FetchConfig(
            dataset_id="real_time_data",
            name="Hourly Fetch",
            fetch_interval_hours=1,
        )
        assert config.fetch_interval_hours == 1

    def test_fetch_config_high_priority(self):
        """Test FetchConfig with high priority."""
        config = FetchConfig(
            dataset_id="critical_data",
            name="Priority Fetch",
            priority=10,
        )
        assert config.priority == 10

    def test_fetch_config_repr(self):
        """Test FetchConfig string representation."""
        config = FetchConfig(
            id=5,
            dataset_id="pop_data",
            name="Population Fetch",
            is_active=True,
        )
        repr_str = repr(config)
        assert "FetchConfig" in repr_str
        assert "5" in repr_str
        assert "Population Fetch" in repr_str
        assert "pop_data" in repr_str
        assert "True" in repr_str

    def test_fetch_config_tablename(self):
        """Test FetchConfig table name."""
        assert FetchConfig.__tablename__ == "fetch_configs"
