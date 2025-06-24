from pydantic import BaseModel, Field, field_validator
from typing import Optional
from pathlib import Path
from datetime import datetime
from typing import Union


class CameraStatusResponse(BaseModel):
    model: str = Field(None)

    connected: bool = Field(...)
    battery: str = Field(None)


class CaptureRequest(BaseModel):
    save_to_path: str = Field(..., description="Relative path within /captures/ directory")
    image_name: Optional[str] = Field(None, description="Image filename without extension")

    @field_validator("save_to_path")
    def validate_save_path(cls, v):
        # Ensure it's a relative path or convert absolute to relative
        path = Path(v)
        if path.is_absolute():
            # Strip leading slash to make it relative
            return str(path.relative_to(path.anchor))
        return v


class CaptureResponse(BaseModel):
    status: str
    filename: str
    timestamp: str
    size_bytes: Optional[int] = None
    static_url: Optional[str] = Field(None, description="Full static URL for accessing the image")


class CameraConfig(BaseModel):
    name: str
    type: str
    label: Optional[str] = None
    read_only: bool
    value: Optional[str] = None  # Allow None values
    choices: list[str] = Field(default_factory=list)

    @field_validator("value", mode="before")
    @classmethod
    def handle_value_types(cls, v):
        """Convert all value types to string or None"""
        if v is None:
            return None
        # Convert any type (int, float, bool, etc.) to string
        return str(v)

    @field_validator("choices", mode="before")
    @classmethod
    def handle_choices_types(cls, v):
        """Ensure choices is always a list of strings"""
        if v is None:
            return []
        if isinstance(v, list):
            # Convert each choice to string
            return [str(choice) for choice in v]
        return []


class ConfigUpdateRequest(BaseModel):
    """Request model for updating camera configurations"""

    configs: dict[str, str] = Field(..., description="Dictionary of config names and their new values")


class ConfigUpdateResponse(BaseModel):
    """Response model for configuration updates"""

    success: bool
    updated_configs: list[str]
    failed_configs: Optional[dict[str, str]] = None
    message: str


class CameraPreset(BaseModel):
    name: str = Field(..., description="Unique preset identifier")
    label: str = Field(..., description="Human-readable preset name")
    description: Optional[str] = Field(None, description="Preset description")
    created_at: datetime = Field(default_factory=datetime.now)
    configs: dict[str, Union[str, int, float, bool]] = Field(..., description="Camera configuration values")

    # Allow arbitrary types for the configs
    model_config = {"arbitrary_types_allowed": True}


class CreatePresetRequest(BaseModel):
    name: str = Field(..., description="Unique preset identifier (filesystem safe)")
    label: str = Field(..., description="Human-readable preset name")
    description: Optional[str] = Field(None, description="Preset description")

    @field_validator("name")
    @classmethod
    def validate_preset_name(cls, v):
        # Ensure filesystem-safe name
        import re

        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Preset name must contain only letters, numbers, underscores, and hyphens")
        return v.lower()


class PresetListResponse(BaseModel):
    presets: list[CameraPreset]


class ApplyPresetResponse(BaseModel):
    success: bool
    applied_configs: list[str]
    message: str
