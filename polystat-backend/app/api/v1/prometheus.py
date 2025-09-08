from fastapi import APIRouter, HTTPException
import logging

from app.services.prometheus_client import PrometheusClient
from app.schemas.prometheus import PrometheusQuery, PrometheusResponse, PrometheusMetricsList

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/metrics", response_model=PrometheusMetricsList)
async def get_metrics_list():
    """Get the list of available Prometheus metrics"""
    try:
        async with PrometheusClient() as client:
            return await client.get_metrics_list()
    except Exception as e:
        logger.error(f"Error getting metrics list: {e}")
        raise HTTPException(
            status_code=503, 
            detail="Prometheus service unavailable"
        )

@router.post("/query", response_model=PrometheusResponse)
async def execute_query(query: PrometheusQuery):
    """Execute an instant Prometheus query"""
    try:
        async with PrometheusClient() as client:
            return await client.instant_query(query)
    except Exception as e:
        logger.error(f"Error executing query: {e}")
        raise HTTPException(
            status_code=503, 
            detail="Failed to execute Prometheus query"
        )
