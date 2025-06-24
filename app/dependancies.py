from app.services.camera_service import CameraService
from app.services.session_service import SessionService
from app.services.image_analysis_service import ImageAnalysisService
from app.services.preset_service import PresetService

camera_service = CameraService()
session_service = SessionService()
image_analysis_service = ImageAnalysisService()
preset_service = PresetService()


def get_camera_service() -> CameraService:
    return camera_service


def get_session_service() -> SessionService:
    return session_service


def get_image_analysis_service() -> ImageAnalysisService:
    return image_analysis_service


def get_preset_service() -> PresetService:
    return preset_service
