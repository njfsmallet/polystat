from pydantic_settings import BaseSettings
from pydantic import field_validator, field_serializer, ConfigDict
from typing import List, Union
from dotenv import load_dotenv

from .constants import (
    DEFAULT_PROMETHEUS_URL, DEFAULT_PROMETHEUS_TIMEOUT,
    DEFAULT_CORS_ORIGINS, DEFAULT_STATIC_DIR
)

# Load .env file
load_dotenv()

class Settings(BaseSettings):
    """Application configuration settings using Pydantic BaseSettings.
    
    This class manages all configuration for the PolyStat Dashboard backend,
    including Prometheus connection settings, CORS origins, and static file paths.
    Settings can be overridden via environment variables.
    """
    # Prometheus Configuration
    prometheus_url: str = DEFAULT_PROMETHEUS_URL
    prometheus_timeout: int = DEFAULT_PROMETHEUS_TIMEOUT
    
    # CORS Configuration - use Union to accept string or list
    cors_origins: Union[str, List[str]] = DEFAULT_CORS_ORIGINS
    
    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v) -> List[str]:
        """Parse CORS origins from string or list format.
        
        Args:
            v: CORS origins as string (comma-separated) or list
            
        Returns:
            List of CORS origin URLs
        """
        if isinstance(v, str):
            # More efficient: avoid creating intermediate lists and filter empties
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        elif isinstance(v, list):
            # Validate list items are strings and non-empty
            return [origin for origin in v if isinstance(origin, str) and origin.strip()]
        return v
    
    @field_serializer('cors_origins')
    def serialize_cors_origins(self, v) -> str:
        """Serialize CORS origins list to comma-separated string.
        
        Args:
            v: List of CORS origin URLs
            
        Returns:
            Comma-separated string of origins
        """
        if isinstance(v, list):
            return ','.join(v)
        return v
    
    # Static Files Configuration
    static_files_dir: str = DEFAULT_STATIC_DIR
    
    # Configuration to allow additional fields
    model_config = ConfigDict(extra='ignore')

# Global settings instance
settings = Settings()
