from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import uvicorn
import logging
import os

from app.core.config import settings
from app.core.constants import (
    APP_NAME, APP_DESCRIPTION, APP_VERSION, SERVICE_NAME,
    PROMETHEUS_PREFIX, ASSETS_PATH, PUBLIC_PATH, INDEX_FILE,
    ERROR_INVALID_PATH, ERROR_NOT_FOUND, ERROR_ACCESS_DENIED,
    ERROR_FRONTEND_NOT_FOUND, ERROR_INTERNAL_SERVER,
    STATUS_HEALTHY, STATUS_UNHEALTHY, PATH_TRAVERSAL_PATTERN,
    FORBIDDEN_PATH_PREFIXES
)
from app.api.v1 import prometheus

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management with startup and shutdown events"""
    try:
        # Startup
        logger.info("Starting PolyStat Dashboard Backend...")
        logger.info("Application initialized successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Error during application lifecycle: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down PolyStat Dashboard Backend...")

# FastAPI application creation
app = FastAPI(
    title=APP_NAME,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router inclusion
app.include_router(prometheus.router, prefix=PROMETHEUS_PREFIX, tags=["prometheus"])

# Static files configuration
static_dir = settings.static_files_dir
if os.path.exists(static_dir):
    # Mount static assets at root for Vite to serve
    app.mount(f"/{ASSETS_PATH}", StaticFiles(directory=os.path.join(static_dir, ASSETS_PATH)), name=ASSETS_PATH)
    
    # Route to serve React application (SPA)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve SPA files with proper error handling and path validation"""
        try:
            # Validate and sanitize path to prevent directory traversal
            if PATH_TRAVERSAL_PATTERN in full_path or full_path.startswith("/") or full_path.startswith(PATH_TRAVERSAL_PATTERN):
                return {"error": ERROR_INVALID_PATH}
            
            # If it's an API route, let FastAPI handle it
            if full_path.startswith(FORBIDDEN_PATH_PREFIXES) or full_path == "health":
                return {"error": ERROR_NOT_FOUND}
            
            # If it's an asset, don't intercept (already handled by mount)
            if full_path.startswith(f"{ASSETS_PATH}/"):
                return {"error": ERROR_NOT_FOUND}
            
            # Check if it's a public file (favicon, etc.)
            public_file = os.path.join(static_dir, PUBLIC_PATH, full_path)
            if os.path.exists(public_file) and os.path.isfile(public_file):
                # Ensure the resolved path is still within static_dir for security
                real_static = os.path.realpath(static_dir)
                real_public = os.path.realpath(public_file)
                if real_public.startswith(real_static):
                    return FileResponse(public_file)
                else:
                    logger.warning(f"Attempted path traversal: {full_path}")
                    return {"error": ERROR_ACCESS_DENIED}
            
            # For all other routes, serve index.html (SPA routing)
            index_file = os.path.join(static_dir, INDEX_FILE)
            if os.path.exists(index_file):
                return FileResponse(index_file)
            else:
                return {"error": ERROR_FRONTEND_NOT_FOUND}
                
        except Exception as e:
            logger.error(f"Error serving SPA file '{full_path}': {e}")
            return {"error": ERROR_INTERNAL_SERVER}
else:
    logger.warning(f"Static files directory not found: {static_dir}")

# Health endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint with error handling"""
    try:
        return {
            "status": STATUS_HEALTHY,
            "service": SERVICE_NAME,
            "version": APP_VERSION
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": STATUS_UNHEALTHY,
            "service": SERVICE_NAME,
            "error": str(e)
        }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with basic API information"""
    try:
        return {
            "message": APP_NAME,
            "version": APP_VERSION,
            "docs": "/docs"
        }
    except Exception as e:
        logger.error(f"Root endpoint failed: {e}")
        return {
            "error": ERROR_INTERNAL_SERVER
        }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
