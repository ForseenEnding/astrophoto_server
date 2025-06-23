from fastapi import APIRouter
from .camera_api import router as camera_api
from .session_api import router as session_api
from .image_analysis_api import router as analysis_api

api_router = APIRouter(
    prefix="/api",
    tags=["api"],
)

api_router.include_router(camera_api)
api_router.include_router(session_api)
api_router.include_router(analysis_api)
