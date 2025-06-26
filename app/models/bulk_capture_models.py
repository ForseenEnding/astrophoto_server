from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.common_models import BaseResponse, SuccessResponse


class BulkCaptureRequest(BaseModel):
    count: int = Field(gt=0, le=1000, description="Number of images to capture (1-1000)")
    interval_seconds: float = Field(ge=0, le=3600, description="Delay between captures in seconds (0-3600)")
    session_id: Optional[str] = Field(None, description="Session ID to capture to (optional)")
    base_name: Optional[str] = Field(None, description="Base name for images (optional)")


class BulkCaptureStatus(BaseModel):
    job_id: str
    status: str  # 'running', 'paused', 'completed', 'cancelled', 'error'
    progress: int  # Images captured so far
    total: int  # Total images to capture
    remaining: int  # Images remaining
    current_interval: float  # Current interval between captures
    estimated_completion: Optional[str]  # ISO timestamp
    error_message: Optional[str] = None
    started_at: str  # ISO timestamp
    last_capture: Optional[str] = None  # ISO timestamp
    successful_captures: int = 0
    failed_captures: int = 0


class BulkCaptureResponse(BaseResponse):
    job_id: str
    status: BulkCaptureStatus


class BulkCaptureJobList(BaseResponse):
    jobs: List[BulkCaptureStatus]
    active_count: int
    completed_count: int
    total_count: int 