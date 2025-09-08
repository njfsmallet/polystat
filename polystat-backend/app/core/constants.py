"""Application constants and configuration values"""

# Application metadata
APP_NAME = "PolyStat Dashboard API"
APP_DESCRIPTION = "API backend for PolyStat Dashboard application"
APP_VERSION = "1.0.0"
SERVICE_NAME = "polystat-dashboard-backend"

# API endpoints
API_V1_PREFIX = "/api/v1"
PROMETHEUS_PREFIX = "/api/v1/prometheus"
HEALTH_ENDPOINT = "/health"
DOCS_ENDPOINT = "/docs"

# Static file paths
ASSETS_PATH = "assets"
PUBLIC_PATH = "public"
INDEX_FILE = "index.html"

# Error messages
ERROR_INVALID_PATH = "Invalid path"
ERROR_NOT_FOUND = "Not found"
ERROR_ACCESS_DENIED = "Access denied"
ERROR_FRONTEND_NOT_FOUND = "Frontend not found"
ERROR_INTERNAL_SERVER = "Internal server error"

# Status messages
STATUS_HEALTHY = "healthy"
STATUS_UNHEALTHY = "unhealthy"
STATUS_SUCCESS = "success"
STATUS_ERROR = "error"

# Prometheus API paths
PROMETHEUS_QUERY_PATH = "/api/v1/query"
PROMETHEUS_METRICS_PATH = "/api/v1/label/__name__/values"

# Default values
DEFAULT_PROMETHEUS_URL = "http://localhost:9090"
DEFAULT_PROMETHEUS_TIMEOUT = 30
DEFAULT_STATIC_DIR = "/app/static"

# CORS origins
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
]

# Path validation patterns
PATH_TRAVERSAL_PATTERN = "../"
FORBIDDEN_PATH_PREFIXES = ("api/", "docs", "redoc")