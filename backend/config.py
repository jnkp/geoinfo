"""Application configuration using Pydantic Settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database Configuration
    database_url: str = "postgresql+asyncpg://geoinfo:geoinfo@localhost:5432/geoinfo"

    # StatFin API Configuration
    statfin_base_url: str = "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin"

    # Background Worker Configuration
    fetch_interval_hours: int = 24

    # Application Settings
    debug: bool = False
    log_level: str = "INFO"

    @property
    def async_database_url(self) -> str:
        """Return the async database URL.

        Ensures the URL uses the asyncpg driver for async SQLAlchemy operations.
        """
        url = self.database_url
        # Convert standard postgresql URL to async version if needed
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    Uses lru_cache to ensure settings are only loaded once.
    """
    return Settings()
