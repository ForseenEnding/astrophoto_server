from fastapi import APIRouter
from .camera_api import router as camera_api
from .session_api import router as session_api
from .image_analysis_api import router as analysis_api
from .preset_api import router as preset_api
from .bulk_capture_api import router as bulk_capture_api
from .session_calibration_api import router as session_calibration_api

# Import v2 APIs
from .v2 import v2_router

# Create main API router
api_router = APIRouter(
    prefix="/api",
    tags=["api"],
)

# Include legacy APIs
api_router.include_router(camera_api)
api_router.include_router(session_api)
api_router.include_router(analysis_api)
api_router.include_router(preset_api)
api_router.include_router(bulk_capture_api)
api_router.include_router(session_calibration_api)

# Include v2 APIs
api_router.include_router(v2_router)
