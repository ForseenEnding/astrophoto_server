from fastapi import Depends
from app.api.base_router import BaseAPIRouter
from app.dependancies import get_preset_service, get_camera_service
from app.models.camera_models import (
    CreatePresetRequest,
)
from app.models.common_models import SuccessResponse
from app.services.preset_service import PresetService, PresetNotFoundError, PresetServiceError
from app.services.camera_service import CameraService
from app.utils.response_helpers import create_success_response, raise_http_exception, status


class PresetAPIRouter(BaseAPIRouter):
    """Preset API router with standardized responses"""
    
    def __init__(self):
        super().__init__(prefix="/presets", tags=["presets"])
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up all preset API routes"""
        
        @self.router.get("/", response_model=SuccessResponse)
        async def list_presets(preset_service: PresetService = Depends(get_preset_service)):
            """List all available camera configuration presets"""
            return self.handle_list_operation("presets", preset_service.list_presets)
        
        @self.router.post("/", response_model=SuccessResponse)
        async def save_current_config_as_preset(
            request: CreatePresetRequest,
            preset_service: PresetService = Depends(get_preset_service),
            camera_service: CameraService = Depends(get_camera_service),
        ):
            """Save current camera configuration as a new preset"""
            self.logger.info(f"Saving current config as preset: {request.name}")
            
            try:
                # Check if camera is connected
                if not camera_service.is_connected():
                    raise_http_exception(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Camera not connected"
                    )
                
                # Check if preset name already exists
                if preset_service.preset_exists(request.name):
                    raise_http_exception(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Preset '{request.name}' already exists"
                    )
                
                # Get current camera configurations
                all_configs = camera_service.get_all_configs()
                
                # Extract config values
                config_values = {}
                for config_name, config_obj in all_configs.items():
                    if config_obj and config_obj.value is not None:
                        config_values[config_name] = config_obj.value
                
                if not config_values:
                    raise_http_exception(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="No camera configurations available to save"
                    )
                
                # Save preset
                preset_data = preset_service.save_preset(
                    name=request.name,
                    label=request.label,
                    configs=config_values,
                    description=request.description
                )
                
                self.logger.info(f"Saved preset '{request.name}' with {len(config_values)} configurations")
                
                return create_success_response(
                    message=f"Preset '{request.name}' saved successfully",
                    data=preset_data
                )
                
            except Exception as e:
                self.logger.error(f"Failed to save preset: {e}")
                raise e
        
        @self.router.get("/{preset_name}", response_model=SuccessResponse)
        async def get_preset(
            preset_name: str,
            preset_service: PresetService = Depends(get_preset_service)
        ):
            """Get a specific preset by name"""
            return self.handle_get_operation("preset", preset_service.get_preset, preset_name)
        
        @self.router.put("/{preset_name}/apply", response_model=SuccessResponse)
        async def apply_preset(
            preset_name: str,
            preset_service: PresetService = Depends(get_preset_service),
            camera_service: CameraService = Depends(get_camera_service),
        ):
            """Apply a preset to the camera"""
            self.logger.info(f"Applying preset: {preset_name}")
            
            try:
                # Check if camera is connected
                if not camera_service.is_connected():
                    raise_http_exception(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Camera not connected"
                    )
                
                # Load preset
                preset_data = preset_service.get_preset(preset_name)
                preset_configs = preset_data.get("configs", {})
                
                if not preset_configs:
                    raise_http_exception(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Preset '{preset_name}' contains no configurations"
                    )
                
                # Apply configurations
                config_tuples = [(name, value) for name, value in preset_configs.items()]
                success = camera_service.set_config(config_tuples)
                
                if not success:
                    raise_http_exception(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to apply preset configurations to camera"
                    )
                
                self.logger.info(f"Applied preset '{preset_name}' with {len(preset_configs)} configurations")
                
                return create_success_response(
                    message=f"Successfully applied preset '{preset_data.get('label', preset_name)}'",
                    data={
                        "success": True,
                        "applied_configs": list(preset_configs.keys()),
                        "preset_name": preset_name
                    }
                )
                
            except Exception as e:
                self.logger.error(f"Error applying preset '{preset_name}': {e}")
                raise e
        
        @self.router.delete("/{preset_name}", response_model=SuccessResponse)
        async def delete_preset(
            preset_name: str,
            preset_service: PresetService = Depends(get_preset_service)
        ):
            """Delete a preset"""
            return self.handle_delete_operation("preset", preset_service.delete_preset, preset_name)


# Create router instance
preset_router = PresetAPIRouter().get_router() 