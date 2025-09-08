from pydantic import BaseModel, Field, validator, ConfigDict
from typing import List, Dict, Optional, Literal, Union
from datetime import datetime, timezone

class PrometheusQuery(BaseModel):
    """Schema for a Prometheus query"""
    metric: Optional[str] = Field(None, description="Name of the Prometheus metric (optional)")
    promql: str = Field(..., min_length=1, description="Complete PromQL query")
    
    model_config = ConfigDict(extra='forbid')

class MetricPoint(BaseModel):
    """Schema for a metric point"""
    name: str = Field(..., min_length=1, description="Metric name")
    value: float = Field(..., description="Numeric value")
    labels: Dict[str, str] = Field(default={}, description="Prometheus labels")
    timestamp: Union[int, datetime] = Field(..., description="Metric timestamp")
    
    @validator('timestamp')
    def validate_timestamp(cls, v) -> datetime:
        """Validate and convert timestamp to datetime object.
        
        Args:
            v: Timestamp as int (Unix timestamp) or datetime object
            
        Returns:
            datetime: Converted datetime object
        """
        if isinstance(v, int):
            # Convert Unix timestamp to datetime
            return datetime.fromtimestamp(v)
        return v
    
    model_config = ConfigDict(extra='forbid')

class PrometheusResponse(BaseModel):
    """Schema for Prometheus query response"""
    status: Literal['success', 'error'] = Field(..., description="Query status")
    data: Optional[List[MetricPoint]] = Field(None, description="Metric data")
    error: Optional[str] = Field(None, description="Error message")
    
    model_config = ConfigDict(extra='forbid')

class PrometheusMetricsList(BaseModel):
    """Schema for available metrics list"""
    metrics: List[str] = Field(..., description="List of metric names")
    total_count: int = Field(..., ge=0, description="Total number of metrics")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    model_config = ConfigDict(extra='forbid')
