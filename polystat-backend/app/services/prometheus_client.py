import httpx
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
from functools import lru_cache

from app.core.config import settings
from app.core.constants import PROMETHEUS_QUERY_PATH, PROMETHEUS_METRICS_PATH, STATUS_SUCCESS, STATUS_ERROR
from app.schemas.prometheus import PrometheusQuery, PrometheusResponse, MetricPoint, PrometheusMetricsList

logger = logging.getLogger(__name__)

class PrometheusConnectionError(Exception):
    """Raised when unable to connect to Prometheus"""
    pass

class PrometheusAPIError(Exception):
    """Raised when Prometheus API returns an error"""
    pass

class PrometheusClient:
    """Client for interacting with Prometheus API"""
    
    def __init__(self):
        """Initialize Prometheus client with configuration settings.
        
        Sets up the HTTP client session with base URL and timeout from settings.
        The client uses async HTTP operations and should be used as a context manager.
        """
        self.base_url = settings.prometheus_url.rstrip('/')
        self.timeout = settings.prometheus_timeout
        # Configure connection limits for better performance
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
        self.session = httpx.AsyncClient(
            timeout=self.timeout,
            limits=limits,
            # Keep connections alive for better performance
            headers={'Connection': 'keep-alive'}
        )
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.session.aclose()
    
    async def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make an HTTP request to the Prometheus API"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = await self.session.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"Prometheus request to {endpoint} completed successfully")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Prometheus HTTP error {e.response.status_code}: {e.response.text}")
            raise PrometheusAPIError(f"Prometheus API error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Prometheus request error: {e}")
            raise PrometheusConnectionError(f"Prometheus connection error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in Prometheus request: {e}")
            raise
    
    async def instant_query(self, query: PrometheusQuery) -> PrometheusResponse:
        """Execute an instant query on Prometheus"""
        try:
            params = {
                'query': query.promql,
                'time': datetime.now(timezone.utc).isoformat()
            }
            
            data = await self._make_request('/api/v1/query', params)
            
            # Handle Prometheus API response format
            if isinstance(data, dict) and 'status' in data:
                if data['status'] == 'success':
                    metric_points = self._process_instant_data(data['data']['result'])
                    return PrometheusResponse(status='success', data=metric_points)
                else:
                    return PrometheusResponse(
                        status='error',
                        error=data.get('error', 'Unknown Prometheus error')
                    )
            elif isinstance(data, dict) and 'data' in data:
                # Direct Prometheus response
                metric_points = self._process_instant_data(data['data']['result'])
                return PrometheusResponse(status='success', data=metric_points)
            else:
                return PrometheusResponse(
                    status='error',
                    error='Unexpected response format'
                )
                
        except Exception as e:
            logger.error(f"Error in instant_query: {e}")
            return PrometheusResponse(
                status='error',
                error=str(e)
            )
    
    async def get_metrics_list(self) -> PrometheusMetricsList:
        """Get the list of available metrics"""
        try:
            data = await self._make_request(PROMETHEUS_METRICS_PATH)
            
            if isinstance(data, dict) and 'status' in data:
                if data['status'] == STATUS_SUCCESS:
                    return PrometheusMetricsList(
                        metrics=data['data'],
                        total_count=len(data['data'])
                    )
                else:
                    raise Exception(f"Failed to get metrics list: {data.get('error', 'Unknown error')}")
            elif isinstance(data, list):
                return PrometheusMetricsList(
                    metrics=data,
                    total_count=len(data)
                )
            else:
                raise Exception(f"Unexpected response format: {type(data)}")
                
        except Exception as e:
            logger.error(f"Error getting metrics list: {e}")
            raise
    
    def _process_instant_data(self, result_data: List[Dict]) -> List[MetricPoint]:
        """Process response data from an instant query"""
        # Pre-allocate list size if known for better memory efficiency
        metric_points = []
        metric_points_append = metric_points.append  # Avoid attribute lookup in loop
        
        for series in result_data:
            # Early continue if no value
            if 'value' not in series:
                continue
                
            series_metric = series['metric']
            metric_name = series_metric.get('__name__', 'custom_metric')
            
            # More efficient dict comprehension with items() iteration
            labels = {k: v for k, v in series_metric.items() if k != '__name__'}
            
            # Unpack and convert in one step
            timestamp, value = series['value'][0], float(series['value'][1])
            
            # Direct append with method reference
            metric_points_append(MetricPoint(
                name=metric_name,
                value=value,
                labels=labels,
                timestamp=timestamp
            ))
        
        return metric_points
