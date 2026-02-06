"""Pytest fixtures for StatFin client tests."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.statfin import (
    StatFinClient,
    StatFinCategory,
    StatFinParsedDimension,
    StatFinDataset,
)


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    settings = MagicMock()
    settings.statfin_base_url = "https://test.api.example.com/StatFin"
    return settings


@pytest.fixture
def statfin_client(mock_settings):
    """Create a StatFinClient with mocked settings."""
    with patch("services.statfin.get_settings", return_value=mock_settings):
        client = StatFinClient()
    return client


@pytest.fixture
def sample_list_response():
    """Sample response from list_tables API call."""
    return [
        {"id": "vaerak", "text": "Väestörakenne", "type": "l"},
        {"id": "statfin_vaerak_pxt_11re.px", "text": "Väestö iän mukaan", "type": "t"},
        {"id": "tyolliset", "text": "Työlliset", "type": "l"},
    ]


@pytest.fixture
def sample_metadata_response():
    """Sample response from get_table_metadata API call."""
    return {
        "title": "Väestö iän ja sukupuolen mukaan",
        "source": "Statistics Finland",
        "updated": "2024-01-15T08:00:00Z",
        "variables": [
            {
                "code": "Alue",
                "text": "Alue",
                "elimination": True,
                "time": False,
                "values": ["SSS", "MK01", "MK02"],
                "valueTexts": ["Koko maa", "Uusimaa", "Varsinais-Suomi"],
            },
            {
                "code": "Vuosi",
                "text": "Vuosi",
                "elimination": False,
                "time": True,
                "values": ["2022", "2023"],
                "valueTexts": ["2022", "2023"],
            },
            {
                "code": "Tiedot",
                "text": "Tiedot",
                "elimination": False,
                "time": False,
                "values": ["vaesto"],
                "valueTexts": ["Väestö"],
            },
        ],
    }


@pytest.fixture
def sample_jsonstat_response():
    """Sample JSON-stat2 response for parsing tests."""
    return {
        "class": "dataset",
        "label": "Väestö 31.12.",
        "source": "Statistics Finland",
        "updated": "2024-01-15T08:00:00Z",
        "id": ["Alue", "Vuosi", "Tiedot"],
        "size": [2, 2, 1],
        "dimension": {
            "Alue": {
                "label": "Alue",
                "category": {
                    "index": {"SSS": 0, "MK01": 1},
                    "label": {"SSS": "Koko maa", "MK01": "Uusimaa"},
                },
            },
            "Vuosi": {
                "label": "Vuosi",
                "category": {
                    "index": {"2022": 0, "2023": 1},
                    "label": {"2022": "2022", "2023": "2023"},
                },
            },
            "Tiedot": {
                "label": "Tiedot",
                "category": {
                    "index": {"vaesto": 0},
                    "label": {"vaesto": "Väestö"},
                },
            },
        },
        "value": [5548241, 5563970, 1734634, 1751717],
    }


@pytest.fixture
def sample_jsonstat_with_missing():
    """Sample JSON-stat2 response with missing values."""
    return {
        "class": "dataset",
        "label": "Test data with missing",
        "source": "Test",
        "updated": "2024-01-01",
        "id": ["Dim1", "Dim2"],
        "size": [2, 2],
        "dimension": {
            "Dim1": {
                "label": "Dimension 1",
                "category": {
                    "index": {"A": 0, "B": 1},
                    "label": {"A": "Value A", "B": "Value B"},
                },
            },
            "Dim2": {
                "label": "Dimension 2",
                "category": {
                    "index": {"X": 0, "Y": 1},
                    "label": {"X": "Value X", "Y": "Value Y"},
                },
            },
        },
        "value": [100, None, 200, 300],
    }


@pytest.fixture
def sample_category():
    """Sample StatFinCategory."""
    return StatFinCategory(index=0, code="SSS", label="Koko maa")


@pytest.fixture
def sample_dimension():
    """Sample StatFinParsedDimension with categories."""
    return StatFinParsedDimension(
        id="Alue",
        label="Alue",
        categories=[
            StatFinCategory(index=0, code="SSS", label="Koko maa"),
            StatFinCategory(index=1, code="MK01", label="Uusimaa"),
            StatFinCategory(index=2, code="MK02", label="Varsinais-Suomi"),
        ],
    )


@pytest.fixture
def sample_dataset(sample_dimension):
    """Sample StatFinDataset for testing."""
    dim1 = sample_dimension
    dim2 = StatFinParsedDimension(
        id="Vuosi",
        label="Vuosi",
        categories=[
            StatFinCategory(index=0, code="2022", label="2022"),
            StatFinCategory(index=1, code="2023", label="2023"),
        ],
    )

    return StatFinDataset(
        label="Test Dataset",
        source="Test Source",
        updated="2024-01-01",
        dimensions=[dim1, dim2],
        values=[100.0, 200.0, 150.0, 250.0, 175.0, 275.0],
        _sizes=[3, 2],
        _dimension_ids=["Alue", "Vuosi"],
    )
