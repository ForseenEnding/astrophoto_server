from fastapi import Depends, Query
from app.api.base_router import BaseAPIRouter
from app.dependancies import get_camera_service
from app.exceptions.camera_exceptions import (
    CameraUSBError,
    CameraError,
    CameraNotConnectedError,
    CameraBusyError,
    CameraCaptureError,
    CameraPreviewError,
)
from app.models.camera_models import (
    CaptureRequest,
    ConfigUpdateRequest,
)
from app.models.common_models import (
    StatusResponse,
    ConnectionResponse,
    SuccessResponse,
)
from app.services.camera_service import CameraService
from app.utils.response_helpers import (
    create_status_response,
    create_connection_response,
    create_success_response,
    raise_http_exception,
    status,
)


class CameraAPIRouter(BaseAPIRouter):
    """Camera API router with standardized responses"""
    
    def __init__(self):
        super().__init__(prefix="/camera", tags=["camera"])
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up all camera API routes"""
        
        @self.router.get("/status", response_model=StatusResponse)
        async def get_camera_status(service: CameraService = Depends(get_camera_service)):
            """Get current camera status"""
            self.logger.info("Getting camera status")
            
            try:
                if not service.is_connected():
                    return create_status_response(
                        status="disconnected",
                        connected=False
                    )
                
                # Get camera configuration values
                configs = service.get_values(["cameramodel", "batterylevel"])
                
                return create_status_response(
                    status="connected",
                    connected=True,
                    details={
                        "model": configs.get("cameramodel", "Unknown"),
                        "battery": configs.get("batterylevel", "Unknown"),
                    }
                )
                
            except CameraError as e:
                self.logger.error(f"Camera error while getting status: {e}")
                raise_http_exception(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Camera error: {str(e)}"
                )
        
        @self.router.post("/connect", response_model=ConnectionResponse)
        async def connect_camera(service: CameraService = Depends(get_camera_service)):
            """Connect to the camera"""
            self.logger.info("Attempting to connect to camera")
            
            try:
                # Check if already connected
                if service.is_connected():
                    return create_connection_response(
                        connected=True,
                        message="Camera already connected"
                    )
                
                # Attempt connection
                if service.connect():
                    return create_connection_response(
                        connected=True,
                        message="Camera connected successfully"
                    )
                else:
                    raise_http_exception(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Failed to connect to camera",
                        headers={"Retry-After": "10"}
                    )
                    
            except CameraUSBError as e:
                self.logger.error(f"USB error during camera connection: {e}")
                if "claim" in str(e).lower():
                    raise_http_exception(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Camera is busy or in use by another application"
                    )
                else:
                    raise_http_exception(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="USB connection error. Try reconnecting camera.",
                        headers={"Retry-After": "15"}
                    )
            except CameraNotConnectedError:
                raise_http_exception(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Camera not found"
                )
            except CameraError as e:
                self.logger.error(f"Camera service error during connection: {e}")
                raise_http_exception(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Camera service error: {type(e)}({str(e)})"
                )
        
        @self.router.post("/disconnect", response_model=ConnectionResponse)
        async def disconnect_camera(service: CameraService = Depends(get_camera_service)):
            """Disconnect from the camera"""
            self.logger.info("Attempting to disconnect camera")
            
            try:
                was_connected = service.is_connected()
                
                if not was_connected:
                    return create_connection_response(
                        connected=False,
                        message="Camera was not connected"
                    )
                
                if service.disconnect():
                    return create_connection_response(
                        connected=False,
                        message="Camera disconnected successfully"
                    )
                else:
                    raise_http_exception(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to disconnect camera cleanly"
                    )
                    
            except CameraError as e:
                self.logger.error(f"Camera error during disconnect: {e}")
                raise_http_exception(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Camera error during disconnect: {str(e)}"
                )
        
        @self.router.post("/capture", response_model=SuccessResponse)
        async def capture_image(
            request: CaptureRequest,
            service: CameraService = Depends(get_camera_service)
        ):
            """Capture a full-resolution image"""
            return self.handle_operation(
                "capture image",
                service.capture,
                request.save_to_path,
                request.image_name
            )
        
        @self.router.post("/preview", response_model=SuccessResponse)
        async def capture_preview(service: CameraService = Depends(get_camera_service)):
            """Capture a preview image"""
            return self.handle_operation("capture preview", service.preview)
        
        @self.router.get("/config/", response_model=SuccessResponse)
        async def get_camera_config(
            names: list[str] = Query(...),
            service: CameraService = Depends(get_camera_service)
        ):
            """Get specific camera configurations"""
            return self.handle_operation(
                "get camera configurations",
                service.get_values,
                names
            )
        
        @self.router.get("/config/all", response_model=SuccessResponse)
        async def get_all_camera_config(service: CameraService = Depends(get_camera_service)):
            """Get all camera configurations"""
            return self.handle_operation(
                "get all camera configurations",
                service.get_all_configs
            )
        
        @self.router.post("/config", response_model=SuccessResponse)
        async def set_camera_config(
            request: ConfigUpdateRequest,
            service: CameraService = Depends(get_camera_service)
        ):
            """Update camera configurations"""
            config_tuples = [(name, value) for name, value in request.configs.items()]
            return self.handle_operation(
                "update camera configurations",
                service.set_config,
                config_tuples
            )
        
        @self.router.get("/config/groups", response_model=SuccessResponse)
        async def get_camera_config_groups(service: CameraService = Depends(get_camera_service)):
            """Get camera configuration groups"""
            config_groups = {
                "exposure": {
                    "label": "Exposure Settings",
                    "description": "Core settings affecting image brightness and quality",
                    "config_names": ["iso", "aperture", "shutterspeed", "exposurecompensation", "meteringmode"],
                },
                "capture": {
                    "label": "Capture Settings",
                    "description": "Image format and capture behavior",
                    "config_names": ["imageformat", "capturetarget", "drivemode", "bracketmode", "aeb"],
                },
                "system": {
                    "label": "System Settings",
                    "description": "Camera status and power management",
                    "config_names": ["datetime", "autopoweroff", "batterylevel", "serialnumber", "availableshots"],
                },
                "advanced": {
                    "label": "Advanced Settings",
                    "description": "Image quality and color fine-tuning",
                    "config_names": ["colorspace", "picturestyle", "highisonr", "whitebalance", "colortemperature"],
                },
            }
            
            return create_success_response(
                message="Retrieved camera configuration groups",
                data={"groups": config_groups}
            )


# Create router instance
camera_router = CameraAPIRouter().get_router() 