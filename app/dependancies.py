from app.services.camera_service import CameraService
from app.services.session_service import SessionService
from app.services.image_analysis_service import ImageAnalysisService

camera_service = CameraService()
session_service = SessionService()
image_analysis_service = ImageAnalysisService()


def get_camera_service() -> CameraService:
    return camera_service


def get_session_service() -> SessionService:
    return session_service


def get_image_analysis_service() -> ImageAnalysisService:
    return image_analysis_service
