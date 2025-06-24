import logging
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.camera_models import (
    CameraPreset,
    CreatePresetRequest,
    PresetListResponse,
    ApplyPresetResponse,
)
from app.services.preset_service import PresetService, PresetNotFoundError, PresetServiceError
from app.services.camera_service import CameraService, CameraError
from app.dependancies import get_preset_service, get_camera_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/presets",
    tags=["presets"],
)


@router.get("/", response_model=PresetListResponse)
async def list_presets(preset_service: PresetService = Depends(get_preset_service)):
    """List all available camera configuration presets"""
    try:
        presets_data = preset_service.list_presets()
        presets = [CameraPreset(**preset) for preset in presets_data]

        return PresetListResponse(presets=presets)

    except PresetServiceError as e:
        logger.error(f"Preset service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list presets: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error listing presets: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error listing presets"
        )


@router.post("/", response_model=CameraPreset)
async def save_current_config_as_preset(
    request: CreatePresetRequest,
    preset_service: PresetService = Depends(get_preset_service),
    camera_service: CameraService = Depends(get_camera_service),
):
    """Save current camera configuration as a new preset"""
    try:
        # Check if camera is connected
        if not camera_service.is_connected():
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")

        # Check if preset name already exists
        if preset_service.preset_exists(request.name):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Preset '{request.name}' already exists")

        # Get current camera configurations
        all_configs = camera_service.get_all_configs()

        # Extract config values - use the raw values from CameraServiceConfig
        config_values = {}
        for config_name, config_obj in all_configs.items():
            if config_obj and config_obj.value is not None:
                print(f"{config_name}: {type(config_obj.value)} = {config_obj.value}")
                config_values[config_name] = config_obj.value
                if not config_values:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST, detail="No camera configurations available to save"
                    )

        # Save preset
        preset_data = preset_service.save_preset(
            name=request.name, label=request.label, configs=config_values, description=request.description
        )

        logger.info(f"Saved preset '{request.name}' with {len(config_values)} configurations")
        return CameraPreset(**preset_data)

    except HTTPException:
        raise
    except CameraError as e:
        logger.error(f"Camera error saving preset: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Camera error: {str(e)}")
    except PresetServiceError as e:
        logger.error(f"Preset service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save preset: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error saving preset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error saving preset"
        )


@router.get("/{preset_name}", response_model=CameraPreset)
async def get_preset(preset_name: str, preset_service: PresetService = Depends(get_preset_service)):
    """Get a specific preset by name"""
    try:
        preset_data = preset_service.get_preset(preset_name)
        return CameraPreset(**preset_data)

    except PresetNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Preset '{preset_name}' not found")
    except PresetServiceError as e:
        logger.error(f"Preset service error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get preset: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting preset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error getting preset"
        )


@router.put("/{preset_name}/apply", response_model=ApplyPresetResponse)
async def apply_preset(
    preset_name: str,
    preset_service: PresetService = Depends(get_preset_service),
    camera_service: CameraService = Depends(get_camera_service),
):
    """Apply a preset to the camera"""
    try:
        # Check if camera is connected
        if not camera_service.is_connected():
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")

        # Load preset
        preset_data = preset_service.get_preset(preset_name)
        preset_configs = preset_data.get("configs", {})

        if not preset_configs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Preset '{preset_name}' contains no configurations"
            )

        # Apply configurations directly - let gphoto2 handle validation
        config_tuples = [(name, value) for name, value in preset_configs.items()]
        success = camera_service.set_config(config_tuples)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to apply preset configurations to camera",
            )

        logger.info(f"Applied preset '{preset_name}' with {len(preset_configs)} configurations")

        return ApplyPresetResponse(
            success=True,
            applied_configs=list(preset_configs.keys()),
            message=f"Successfully applied preset '{preset_data.get('label', preset_name)}'",
        )

    except HTTPException:
        raise
    except Exception as e:
        # This will catch gphoto2 errors and bubble them up
        logger.error(f"Error applying preset '{preset_name}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to apply preset: {str(e)}"
        )


@router.delete("/{preset_name}")
async def delete_preset(preset_name: str, preset_service: PresetService = Depends(get_preset_service)):
    """Delete a preset"""
    try:
        preset_service.delete_preset(preset_name)
        return {"message": f"Preset '{preset_name}' deleted successfully"}

    except PresetNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Preset '{preset_name}' not found")
    except PresetServiceError as e:
        logger.error(f"Preset service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete preset: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error deleting preset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error deleting preset"
        )
