"""
Dependency injection system for the astrophoto server.

This module provides centralized dependency injection for all services,
ensuring proper initialization, lifecycle management, and type safety.
"""

from typing import Annotated, Optional
from fastapi import Depends
from functools import lru_cache

from app.services.camera_service import CameraService
from app.services.session_service import SessionService
from app.services.image_analysis_service import ImageAnalysisService
from app.services.preset_service import PresetService
from app.services.bulk_capture_service import BulkCaptureService
from app.utils.logging_config import get_logger

logger = get_logger(__name__)


# Service instances (singletons)
_camera_service: Optional[CameraService] = None
_session_service: Optional[SessionService] = None
_image_analysis_service: Optional[ImageAnalysisService] = None
_preset_service: Optional[PresetService] = None


@lru_cache()
def get_camera_service() -> CameraService:
    """Get the camera service singleton instance."""
    global _camera_service
    if _camera_service is None:
        logger.info("Initializing camera service")
        _camera_service = CameraService()
    return _camera_service


@lru_cache()
def get_session_service() -> SessionService:
    """Get the session service singleton instance."""
    global _session_service
    if _session_service is None:
        logger.info("Initializing session service")
        _session_service = SessionService()
    return _session_service


@lru_cache()
def get_image_analysis_service() -> ImageAnalysisService:
    """Get the image analysis service singleton instance."""
    global _image_analysis_service
    if _image_analysis_service is None:
        logger.info("Initializing image analysis service")
        _image_analysis_service = ImageAnalysisService()
    return _image_analysis_service


@lru_cache()
def get_preset_service() -> PresetService:
    """Get the preset service singleton instance."""
    global _preset_service
    if _preset_service is None:
        logger.info("Initializing preset service")
        _preset_service = PresetService()
    return _preset_service


def get_bulk_capture_service() -> BulkCaptureService:
    """Get a new bulk capture service instance (not singleton)."""
    camera_service = get_camera_service()
    session_service = get_session_service()
    return BulkCaptureService(camera_service, session_service)


# Type aliases for dependency injection
CameraServiceDep = Annotated[CameraService, Depends(get_camera_service)]
SessionServiceDep = Annotated[SessionService, Depends(get_session_service)]
ImageAnalysisServiceDep = Annotated[ImageAnalysisService, Depends(get_image_analysis_service)]
PresetServiceDep = Annotated[PresetService, Depends(get_preset_service)]
BulkCaptureServiceDep = Annotated[BulkCaptureService, Depends(get_bulk_capture_service)]


def cleanup_services():
    """Clean up all service instances (useful for testing)."""
    global _camera_service, _session_service, _image_analysis_service, _preset_service
    
    logger.info("Cleaning up service instances")
    
    if _camera_service:
        try:
            _camera_service.disconnect()
        except Exception as e:
            logger.warning(f"Error disconnecting camera service: {e}")
        _camera_service = None
    
    _session_service = None
    _image_analysis_service = None
    _preset_service = None
    
    # Clear lru_cache
    get_camera_service.cache_clear()
    get_session_service.cache_clear()
    get_image_analysis_service.cache_clear()
    get_preset_service.cache_clear() 