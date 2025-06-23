from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class CameraCaptureSettings(BaseModel):
    iso: Optional[str] = None
    aperture: Optional[str] = None
    shutterspeed: Optional[str] = None
    captured_at: Optional[datetime] = None


class CapturePlan(BaseModel):
    target_count: int = Field(default=50, description="Target number of images to capture")
    exposure_time: str = Field(default="30s", description="Planned exposure time per image")
    filter: str = Field(default="none", description="Filter being used")


class SessionStatistics(BaseModel):
    total_captures: int = 0
    successful_captures: int = 0
    failed_captures: int = 0
    total_exposure_time: str = "0s"
    average_focus_score: Optional[float] = None


class SessionImage(BaseModel):
    filename: str
    captured_at: datetime
    size_bytes: Optional[int] = None
    focus_score: Optional[float] = None
    preview_path: Optional[str] = None


class Session(BaseModel):
    id: str
    name: str
    target: str
    created_at: datetime
    updated_at: datetime
    status: SessionStatus = SessionStatus.ACTIVE
    camera_settings: Optional[CameraCaptureSettings] = None
    capture_plan: CapturePlan = Field(default_factory=CapturePlan)
    statistics: SessionStatistics = Field(default_factory=SessionStatistics)
    images: List[SessionImage] = Field(default_factory=list)

    def update_timestamp(self):
        """Update the updated_at timestamp"""
        self.updated_at = datetime.now()


# Request/Response models for API
class CreateSessionRequest(BaseModel):
    name: str = Field(..., description="Human-readable session name")
    target: str = Field(..., description="Target object (e.g., M31, NGC7000)")
    capture_plan: Optional[CapturePlan] = None

    @field_validator("target")
    def validate_target(cls, v):
        # Clean up target name for filesystem use
        return v.strip().replace(" ", "_").replace("/", "_")


class CreateSessionResponse(BaseModel):
    session: Session
    message: str


class SessionListResponse(BaseModel):
    sessions: List[Session]
    active_session_id: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[SessionStatus] = None
    capture_plan: Optional[CapturePlan] = None


class SessionCaptureRequest(BaseModel):
    image_name: Optional[str] = Field(None, description="Optional custom image name")


class SessionCaptureResponse(BaseModel):
    status: str
    filename: str
    session_id: str
    capture_number: int
    timestamp: str
    size_bytes: Optional[int] = None
    static_url: str
