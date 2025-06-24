# app/api/bulk_capture_api.py
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4
from pathlib import Path

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel, Field

from app.services.camera_service import CameraService
from app.services.session_service import SessionService
from app.dependancies import get_camera_service
from app.exceptions.camera_exceptions import CameraNotConnectedError, CameraCaptureError

logger = logging.getLogger(__name__)

# Global store for active bulk capture jobs
active_jobs: Dict[str, "BulkCaptureJob"] = {}


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


class BulkCaptureResponse(BaseModel):
    job_id: str
    message: str
    status: BulkCaptureStatus


class BulkCaptureJob:
    def __init__(
        self, job_id: str, request: BulkCaptureRequest, camera_service: CameraService, session_service: SessionService
    ):
        self.job_id = job_id
        self.request = request
        self.camera_service = camera_service
        self.session_service = session_service
        self.status = "running"
        self.progress = 0
        self.successful_captures = 0
        self.failed_captures = 0
        self.started_at = datetime.now()
        self.last_capture = None
        self.error_message = None
        self._cancelled = False
        self._paused = False
        self._task = None

    async def run(self):
        """Execute the bulk capture sequence"""
        logger.info(f"Starting bulk capture job {self.job_id}: {self.request.count} images")

        try:
            for i in range(self.request.count):
                if self._cancelled:
                    self.status = "cancelled"
                    break

                # Wait if paused
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.1)

                if self._cancelled:
                    self.status = "cancelled"
                    break

                # Check camera connection
                if not self.camera_service.is_connected():
                    self.error_message = "Camera disconnected during bulk capture"
                    self.status = "error"
                    break

                # Capture image
                try:
                    image_name = self._generate_image_name(i + 1)

                    if self.request.session_id:
                        # Capture to session
                        session = self.session_service.get_session(self.request.session_id)
                        captures_path = self.session_service.get_session_captures_path(self.request.session_id)
                        result = self.camera_service.capture(save_to_path=str(captures_path), image_name=image_name)

                        if result:
                            # Add to session
                            file_path = Path(result["path"])
                            file_size = file_path.stat().st_size if file_path.exists() else None
                            self.session_service.add_image_to_session(
                                session_id=self.request.session_id, filename=result["filename"], size_bytes=file_size
                            )
                    else:
                        # Capture to default location
                        result = self.camera_service.capture(save_to_path="captures/default", image_name=image_name)

                    if result:
                        self.successful_captures += 1
                        self.last_capture = datetime.now()
                        logger.info(
                            f"Bulk capture {self.job_id}: captured {result['filename']} ({i + 1}/{self.request.count})"
                        )
                    else:
                        self.failed_captures += 1
                        logger.warning(f"Bulk capture {self.job_id}: failed to capture image {i + 1}")

                except Exception as e:
                    self.failed_captures += 1
                    logger.error(f"Bulk capture {self.job_id}: error capturing image {i + 1}: {e}")

                self.progress += 1

                # Wait before next capture (if not the last one)
                if i < self.request.count - 1 and self.request.interval_seconds > 0:
                    await asyncio.sleep(self.request.interval_seconds)

            if self.status == "running":
                self.status = "completed"
                logger.info(
                    (
                        f"Bulk capture job {self.job_id} completed: "
                        f"{self.successful_captures} successful, "
                        f"{self.failed_captures} failed"
                    )
                )

        except Exception as e:
            self.error_message = str(e)
            self.status = "error"
            logger.error(f"Bulk capture job {self.job_id} failed: {e}")

        finally:
            # Clean up after a delay
            asyncio.create_task(self._cleanup_after_delay())

    def _generate_image_name(self, sequence: int) -> str:
        """Generate image name for sequence"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if self.request.base_name:
            return f"{self.request.base_name}_{sequence:03d}_{timestamp}"
        elif self.request.session_id:
            session = self.session_service.get_session(self.request.session_id)
            return f"{session.target}_{sequence:03d}_{timestamp}"
        else:
            return f"bulk_{sequence:03d}_{timestamp}"

    def pause(self):
        """Pause the bulk capture"""
        self._paused = True
        self.status = "paused"

    def resume(self):
        """Resume the bulk capture"""
        self._paused = False
        self.status = "running"

    def cancel(self):
        """Cancel the bulk capture"""
        self._cancelled = True
        self.status = "cancelled"

    async def _cleanup_after_delay(self):
        """Remove job from active jobs after delay"""
        await asyncio.sleep(300)  # Keep job info for 5 minutes
        if self.job_id in active_jobs:
            del active_jobs[self.job_id]

    def get_status(self) -> BulkCaptureStatus:
        """Get current job status"""
        remaining = max(0, self.request.count - self.progress)

        # Estimate completion time
        estimated_completion = None
        if self.status == "running" and remaining > 0 and self.request.interval_seconds > 0:
            seconds_remaining = remaining * self.request.interval_seconds
            completion_time = datetime.now().timestamp() + seconds_remaining
            estimated_completion = datetime.fromtimestamp(completion_time).isoformat()

        return BulkCaptureStatus(
            job_id=self.job_id,
            status=self.status,
            progress=self.progress,
            total=self.request.count,
            remaining=remaining,
            current_interval=self.request.interval_seconds,
            estimated_completion=estimated_completion,
            error_message=self.error_message,
            started_at=self.started_at.isoformat(),
            last_capture=self.last_capture.isoformat() if self.last_capture else None,
            successful_captures=self.successful_captures,
            failed_captures=self.failed_captures,
        )


router = APIRouter(
    prefix="/bulk-capture",
    tags=["bulk-capture"],
)


def get_session_service() -> SessionService:
    """Dependency to get session service"""
    from app.api.session_api import session_service

    return session_service


@router.post("/start", response_model=BulkCaptureResponse)
async def start_bulk_capture(
    request: BulkCaptureRequest,
    background_tasks: BackgroundTasks,
    camera_service: CameraService = Depends(get_camera_service),
    session_service: SessionService = Depends(get_session_service),
):
    """Start a bulk capture sequence"""

    # Validate camera connection
    if not camera_service.is_connected():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")

    # Validate session if provided
    if request.session_id:
        try:
            session_service.get_session(request.session_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {request.session_id} not found")

    # Create job
    job_id = str(uuid4())
    job = BulkCaptureJob(job_id, request, camera_service, session_service)
    active_jobs[job_id] = job

    # Start background task
    job._task = asyncio.create_task(job.run())

    logger.info(f"Started bulk capture job {job_id}")

    return BulkCaptureResponse(
        job_id=job_id, message=f"Bulk capture started: {request.count} images", status=job.get_status()
    )


@router.get("/{job_id}/status", response_model=BulkCaptureStatus)
async def get_bulk_capture_status(job_id: str):
    """Get status of a bulk capture job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bulk capture job not found")

    return active_jobs[job_id].get_status()


@router.post("/{job_id}/pause")
async def pause_bulk_capture(job_id: str):
    """Pause a running bulk capture job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bulk capture job not found")

    job = active_jobs[job_id]
    if job.status != "running":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only pause running jobs")

    job.pause()
    return {"message": "Bulk capture paused"}


@router.post("/{job_id}/resume")
async def resume_bulk_capture(job_id: str):
    """Resume a paused bulk capture job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bulk capture job not found")

    job = active_jobs[job_id]
    if job.status != "paused":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only resume paused jobs")

    job.resume()
    return {"message": "Bulk capture resumed"}


@router.post("/{job_id}/cancel")
async def cancel_bulk_capture(job_id: str):
    """Cancel a bulk capture job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bulk capture job not found")

    job = active_jobs[job_id]
    if job.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job is already completed or cancelled")

    job.cancel()
    return {"message": "Bulk capture cancelled"}


@router.get("/jobs")
async def list_bulk_capture_jobs():
    """List all active bulk capture jobs"""
    jobs = {}
    for job_id, job in active_jobs.items():
        jobs[job_id] = job.get_status()

    return {"jobs": jobs}
