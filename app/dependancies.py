from app.services.camera_service import CameraService

camera_service = CameraService()


def get_camera_service() -> CameraService:
    return camera_service
