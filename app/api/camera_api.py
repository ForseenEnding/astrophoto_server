import logging
from pathlib import Path
from datetime import datetime
from fastapi import Depends, APIRouter, status, HTTPException, Response, Query
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
    CameraStatusResponse,
    CaptureRequest,
    CaptureResponse,
    CameraConfig,
    ConfigUpdateRequest,
    ConfigUpdateResponse,
)
from app.services.camera_service import CameraService, CameraServiceConfig

# Configure logger for this module
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("logs/camera_api.log"), logging.StreamHandler()],
)

router = APIRouter(
    prefix="/camera",
    tags=["camera"],
)


@router.get(path="/status", response_model=CameraStatusResponse)
async def get_camera_status(service: CameraService = Depends(get_camera_service)):
    """
    Get current camera status including connection state, model, and battery level.

    Returns:
        CameraStatusResponse: Camera status information

    Raises:
        HTTPException: 503 if camera is not connected
    """
    logger.info("Getting camera status")

    try:
        if not service.is_connected():
            return CameraStatusResponse(connected=False)

        # Get camera configuration values
        configs = service.get_values(["cameramodel", "batterylevel"])
        logger.debug(f"Retrieved camera configs: {configs}")

        response = CameraStatusResponse(
            connected=service.is_connected(),
            model=configs.get("cameramodel", "Unknown"),
            battery=configs.get("batterylevel", "Unknown"),
        )

        logger.info(f"Camera status retrieved: model={response.model}, battery={response.battery}")
        return response

    except CameraError as e:
        logger.error(f"Camera error while getting status: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Camera error: {str(e)}")


@router.post("/connect")
async def connect_camera(service: CameraService = Depends(get_camera_service)):
    """
    Connect to the camera.

    Returns:
        dict: Connection status and message

    Raises:
        HTTPException: Various status codes based on connection failure reason
    """
    logger.info("Attempting to connect to camera")

    try:
        # Check if already connected
        if service.is_connected():
            logger.info("Camera already connected")
            return {"status": "connected", "message": "Camera already connected"}

        # Attempt connection
        if service.connect():
            logger.info("Camera connected successfully")
            return {"status": "connected", "message": "Camera connected successfully"}
        else:
            logger.error("Failed to connect to camera - unknown reason")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to connect to camera",
                headers={"Retry-After": "10"},
            )

    except CameraUSBError as e:
        logger.error(f"USB error during camera connection: {e}")
        if "claim" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Camera is busy or in use by another application",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="USB connection error. Try reconnecting camera.",
                headers={"Retry-After": "15"},
            )
    except CameraNotConnectedError:
        logger.error("Camera not found")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not found")
    except CameraError as e:
        logger.error(f"Camera service error during connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Camera service error: {type(e)}({str(e)})"
        )
    except Exception as e:
        logger.error(f"Unexpected error during camera connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during camera connection"
        )


@router.post("/disconnect")
async def disconnect_camera(service: CameraService = Depends(get_camera_service)):
    """
    Disconnect from the camera.

    Returns:
        dict: Disconnection status and message

    Raises:
        HTTPException: 500 if disconnection fails
    """
    logger.info("Attempting to disconnect camera")

    try:
        was_connected = service.is_connected()

        if not was_connected:
            logger.info("Camera was not connected")
            return {
                "status": "already_disconnected",
                "message": "Camera was not connected",
            }

        if service.disconnect():
            logger.info("Camera disconnected successfully")
            return {
                "status": "disconnected",
                "message": "Camera disconnected successfully",
            }
        else:
            logger.error("Failed to disconnect camera cleanly")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to disconnect camera cleanly",  # Fixed typo
            )

    except CameraError as e:
        logger.error(f"Camera error during disconnect: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Camera error during disconnect: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error during camera disconnect: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during disconnect"
        )


@router.post("/capture", response_model=CaptureResponse)
async def capture_image(request: CaptureRequest, service: CameraService = Depends(get_camera_service)):
    """
    Capture a full-resolution image from the camera.

    Images are automatically saved to /captures/{save_to_path}/ for static serving.

    Args:
        request: Capture request containing relative save path and optional image name

    Returns:
        CaptureResponse: Capture result with file information and static URL

    Raises:
        HTTPException: Various status codes based on capture failure reason
    """
    logger.info(f"Starting image capture to captures/{request.save_to_path}")

    try:
        # Construct path within captures root (relative to working directory)
        captures_root = Path("captures")
        relative_path = Path(captures_root / request.save_to_path)
        absolute_path = relative_path.resolve()

        logger.debug(f"Resolved save path: {absolute_path}")

        # Attempt the capture
        result = service.capture(save_to_path=absolute_path, image_name=request.image_name)

        if result is None:
            logger.error("Capture returned None - camera not connected")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")

        # Get file path as an absolute and convert back to relative
        file_path = Path(captures_root, Path(result["path"]).relative_to(captures_root.resolve()))
        file_size = file_path.stat().st_size if file_path.exists() else None

        logger.info(f"Image captured successfully: {result['filename']} ({file_size} bytes) at {file_path}")

        return CaptureResponse(
            status="captured",
            static_url=str(file_path),  # Return relative path for static serving
            filename=result["filename"],
            timestamp=result["timestamp"],
            size_bytes=file_size,
        )

    except CameraNotConnectedError:
        logger.error("Capture failed - camera not connected")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")
    except CameraBusyError:
        logger.warning("Capture failed - camera busy")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Camera is busy with another operation",
            headers={"Retry-After": "5"},
        )
    except CameraCaptureError as e:
        logger.error(f"Camera capture error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Capture failed: {str(e)}")
    except PermissionError as e:
        logger.error(f"Permission error during capture: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to write to the specified path"
        )
    except OSError as e:
        logger.error(f"File system error during capture: {e}")
        if e.errno == 28:  # No space left on device
            raise HTTPException(status_code=507, detail="Insufficient storage space")  # Insufficient Storage
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File system error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during capture: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during image capture"
        )


@router.post("/preview")
async def capture_preview(service: CameraService = Depends(get_camera_service)):
    """
    Capture a preview image from the camera.

    Previews are automatically saved to /captures/previews/ for static serving.

    Args:
        request: Preview request with optional relative save path and image name

    Returns:
        Response: Either raw image data or JSON metadata based on return_image_data flag

    Raises:
        HTTPException: Various status codes based on preview failure reason
    """
    logger.info("Starting preview capture")

    try:
        # Capture the preview
        image_data = service.preview()

        if image_data is None:
            logger.error("Preview capture failed - returned None")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Failed to capture preview")

        return Response(
            content=image_data,
            media_type="image/jpeg",
            headers={
                "X-Image-Size": str(len(image_data)),
                "X-Timestamp": datetime.now().isoformat(),
                "Cache-Control": "no-cache",  # Prevent caching of live preview
            },
        )

    except CameraNotConnectedError:
        logger.error("Preview failed - camera not connected")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")
    except CameraBusyError:
        logger.warning("Preview failed - camera busy")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Camera is busy. Preview may not be available during capture.",
            headers={"Retry-After": "2"},
        )
    except CameraPreviewError as e:
        logger.error(f"Camera preview error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Preview capture failed: {str(e)}"
        )
    except PermissionError as e:
        logger.error(f"Permission error during preview: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to write to the specified path",
        )
    except OSError as e:
        logger.error(f"File system error during preview: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File system error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during preview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during preview capture"
        )


@router.get("/config/")
async def get_camera_config(names: list[str] = Query(...), service: CameraService = Depends(get_camera_service)):
    try:
        results = {}
        logger.debug(f"get_camera_config({type(names)})")
        configs: dict[str, CameraServiceConfig] = service.get_config(names)
        for name, config in configs.items():
            if config is None:
                results[name] = None
                continue

            results[name] = CameraConfig(
                name=config.name,
                type=config.type,
                label=config.label,
                read_only=config.read_only,
                value=config.value,
                choices=config.choices,
            )
        return results
    except Exception as e:
        logger.error(f"Unexpected error getting config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error getting config"
        )


@router.get("/config/all")
async def get_all_camera_config(service: CameraService = Depends(get_camera_service)):
    try:
        results = {}
        logger.debug("get_all_camera_config()")
        configs: dict[str, CameraServiceConfig] = service.get_all_configs()
        for name, config in configs.items():
            if config is None:
                results[name] = None
                continue

            results[name] = CameraConfig(
                name=config.name,
                type=config.type,
                label=config.label,
                read_only=config.read_only,
                value=config.value,
                choices=config.choices,
            )

        return results
    except Exception as e:
        logger.error(f"Unexpected error getting config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error getting config"
        )


@router.post("/config", response_model=ConfigUpdateResponse)
async def set_camera_config(request: ConfigUpdateRequest, service: CameraService = Depends(get_camera_service)):
    """
    Set camera configuration settings.

    Args:
        request: Dictionary of configuration names and their new values
        service: Camera service dependency

    Returns:
        ConfigUpdateResponse with success status and details
    """
    try:
        logger.info(f"Setting camera configs: {list(request.configs.keys())}")

        # Convert dict to list of tuples for the existing service method
        config_tuples = [(name, value) for name, value in request.configs.items()]

        # Attempt to set the configurations
        success = service.set_config(config_tuples)

        if success:
            updated_configs = list(request.configs.keys())
            logger.info(f"Successfully updated {len(updated_configs)} configurations")

            return ConfigUpdateResponse(
                success=True,
                updated_configs=updated_configs,
                message=f"Successfully updated {len(updated_configs)} configuration(s)",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update camera configurations"
            )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error setting camera config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error setting camera configuration",
        )
