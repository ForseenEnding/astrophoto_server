from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from app.models.common_models import BaseResponse


class CalibrationFrameType(str, Enum):
    DARK = "dark"
    BIAS = "bias"
    FLAT = "flat"
    FLAT_DARK = "flat_dark"


class CalibrationCaptureRequest(BaseModel):
    session_id: str = Field(..., description="Session to capture calibration frames for")
    frame_type: CalibrationFrameType
    count: int = Field(gt=0, le=200, description="Number of frames to capture")

    # Frame-specific settings
    exposure_time: Optional[str] = None  # Required for darks and flat darks
    target_adu: Optional[int] = Field(None, ge=10000, le=50000, description="Target ADU for flats")

    # Timing
    interval_seconds: float = Field(default=2.0, ge=0.5, le=60)
    delay_before_start: float = Field(default=0, ge=0, le=300)


class CalibrationJobStatus(BaseModel):
    job_id: str
    session_id: str
    frame_type: CalibrationFrameType
    status: str  # pending, running, paused, completed, failed, cancelled
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    total_frames: int
    completed_frames: int
    failed_frames: int
    current_temperature: Optional[float] = None
    average_adu: Optional[float] = None

    output_directory: str
    captured_files: List[str] = []
    estimated_completion: Optional[datetime] = None
    error_message: Optional[str] = None


class CalibrationResponse(BaseResponse):
    job_id: str
    status: CalibrationJobStatus


class CalibrationJobList(BaseResponse):
    jobs: List[CalibrationJobStatus]
    session_id: str


class CalibrationStructure(BaseResponse):
    session_id: str
    calibration_dirs: dict[str, str]
    frame_counts: dict[str, int]
    total_files: int


class CalibrationPreset(BaseModel):
    name: str
    description: str
    frame_type: CalibrationFrameType
    count: int
    exposure_time: Optional[str] = None
    target_adu: Optional[int] = None
    interval_seconds: float = 2.0
    delay_before_start: float = 0


class CalibrationPresetList(BaseResponse):
    presets: List[CalibrationPreset] 