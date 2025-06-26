from fastapi import APIRouter
from .camera import camera_router
from .session import session_router
from .preset import preset_router
from .bulk_capture import bulk_capture_router
from .calibration import calibration_router
from .analysis import analysis_router

# Create v2 API router
v2_router = APIRouter(
    prefix="/v2",
    tags=["v2"],
)

# Include all v2 routers
v2_router.include_router(camera_router)
v2_router.include_router(session_router)
v2_router.include_router(preset_router)
v2_router.include_router(bulk_capture_router)
v2_router.include_router(calibration_router)
v2_router.include_router(analysis_router) 