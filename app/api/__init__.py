from fastapi import APIRouter
from .camera_api import router as camera_api

api_router = APIRouter(
    prefix="/api",
    tags=["api"],
)

api_router.include_router(camera_api)
