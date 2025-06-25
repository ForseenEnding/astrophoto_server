# app/api/session_calibration_api.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import uuid
import logging
from pathlib import Path

from app.services.session_service import SessionService, SessionNotFoundError
from app.services.camera_service import CameraService
from app.dependancies import get_camera_service

logger = logging.getLogger(__name__)


# Calibration frame types
class CalibrationFrameType(str, Enum):
    DARK = "dark"
    BIAS = "bias"
    FLAT = "flat"
    FLAT_DARK = "flat_dark"


# Request models
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


# Response models
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


class CalibrationResponse(BaseModel):
    job_id: str
    message: str
    status: CalibrationJobStatus


# Session calibration manager
class SessionCalibrationManager:
    def __init__(self, session_service: SessionService, camera_service: CameraService):
        self.session_service = session_service
        self.camera_service = camera_service
        self.active_jobs: Dict[str, "CalibrationJob"] = {}

    def create_calibration_directories(self, session_id: str) -> Dict[str, Path]:
        """Create calibration subdirectories within session folder"""
        session_path = self.session_service._get_session_path(session_id)

        calibration_dirs = {}
        for frame_type in CalibrationFrameType:
            cal_dir = session_path / "calibration" / frame_type.value
            cal_dir.mkdir(parents=True, exist_ok=True)
            calibration_dirs[frame_type.value] = cal_dir

        return calibration_dirs

    def get_calibration_path(self, session_id: str, frame_type: CalibrationFrameType) -> Path:
        """Get the path for a specific calibration frame type"""
        session_path = self.session_service._get_session_path(session_id)
        return session_path / "calibration" / frame_type.value

    def start_calibration_job(self, request: CalibrationCaptureRequest) -> "CalibrationJob":
        """Start a calibration capture job for a session"""
        job_id = str(uuid.uuid4())

        # Verify session exists
        try:
            session = self.session_service.get_session(request.session_id)
        except SessionNotFoundError:
            raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found")

        # Create calibration directories
        self.create_calibration_directories(request.session_id)

        # Create and start job
        job = CalibrationJob(job_id, request, self.camera_service, self)
        self.active_jobs[job_id] = job

        # Start background task
        asyncio.create_task(job.run())

        return job


# Calibration job implementation
class CalibrationJob:
    def __init__(
        self,
        job_id: str,
        request: CalibrationCaptureRequest,
        camera_service: CameraService,
        manager: SessionCalibrationManager,
    ):
        self.job_id = job_id
        self.request = request
        self.camera_service = camera_service
        self.manager = manager

        self.status = "pending"
        self.created_at = datetime.now()
        self.started_at = None
        self.completed_at = None
        self.error_message = None

        self.total_frames = request.count
        self.completed_frames = 0
        self.failed_frames = 0
        self.captured_files = []

        self.current_temperature = None
        self.average_adu = None
        self.estimated_completion = None

        # Get output directory
        self.output_directory = str(self.manager.get_calibration_path(request.session_id, request.frame_type))

        # Control flags
        self._should_stop = False
        self._is_paused = False

    async def run(self):
        """Execute the calibration capture sequence"""
        try:
            self.status = "running"
            self.started_at = datetime.now()

            logger.info(
                f"Starting calibration job {self.job_id}: {self.request.frame_type.value} "
                f"frames for session {self.request.session_id}"
            )

            # Wait for start delay
            if self.request.delay_before_start > 0:
                logger.info(f"Waiting {self.request.delay_before_start}s before starting")
                await asyncio.sleep(self.request.delay_before_start)

            # Main capture loop
            for frame_num in range(1, self.total_frames + 1):
                if self._should_stop:
                    self.status = "cancelled"
                    break

                # Wait if paused
                while self._is_paused and not self._should_stop:
                    await asyncio.sleep(0.5)

                if self._should_stop:
                    break

                try:
                    # Generate filename
                    filename = self._generate_filename(frame_num)

                    # Capture frame
                    result = self.camera_service.capture(save_to_path=Path(self.output_directory), image_name=filename)

                    if result:
                        self.captured_files.append(result["filename"])
                        self.completed_frames += 1

                        # Update temperature if available
                        # self.current_temperature = self.camera_service.get_temperature()

                        logger.info(
                            f"Captured {self.request.frame_type.value} frame {frame_num}/{self.total_frames}: {filename}"
                        )
                    else:
                        self.failed_frames += 1
                        logger.warning(f"Failed to capture frame {frame_num}")

                except Exception as e:
                    self.failed_frames += 1
                    logger.error(f"Error capturing frame {frame_num}: {e}")

                # Update progress and ETA
                self._update_progress()

                # Wait interval before next capture (except for last frame)
                if frame_num < self.total_frames and not self._should_stop:
                    await asyncio.sleep(self.request.interval_seconds)

            # Finalize job
            if not self._should_stop:
                self.status = "completed"
                self.completed_at = datetime.now()
                await self._save_calibration_metadata()

                logger.info(
                    f"Calibration job {self.job_id} completed: "
                    f"{self.completed_frames}/{self.total_frames} frames captured"
                )

        except Exception as e:
            self.status = "failed"
            self.error_message = str(e)
            logger.error(f"Calibration job {self.job_id} failed: {e}")

        finally:
            # Clean up
            if self.job_id in self.manager.active_jobs:
                del self.manager.active_jobs[self.job_id]

    def _generate_filename(self, frame_number: int) -> str:
        """Generate standardized filename for calibration frame"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Include frame type and settings in filename
        params = [self.request.frame_type.value]

        if self.request.exposure_time:
            # Convert exposure to filename-safe format
            exp_safe = self.request.exposure_time.replace("/", "-").replace('"', "s")
            params.append(f"exp{exp_safe}")

        if self.current_temperature:
            params.append(f"temp{self.current_temperature:.1f}C")

        param_str = "_".join(params)
        return f"{param_str}_{timestamp}_f{frame_number:03d}"

    def _update_progress(self):
        """Update estimated completion time"""
        if self.completed_frames > 0 and self.started_at:
            elapsed = (datetime.now() - self.started_at).total_seconds()
            avg_time_per_frame = elapsed / self.completed_frames
            remaining_frames = self.total_frames - self.completed_frames

            if remaining_frames > 0:
                eta_seconds = remaining_frames * avg_time_per_frame
                self.estimated_completion = datetime.now() + timedelta(seconds=eta_seconds)

    async def _save_calibration_metadata(self):
        """Save calibration metadata to session"""
        metadata = {
            "job_id": self.job_id,
            "frame_type": self.request.frame_type.value,
            "session_id": self.request.session_id,
            "total_frames": self.total_frames,
            "completed_frames": self.completed_frames,
            "failed_frames": self.failed_frames,
            "captured_files": self.captured_files,
            "settings": {
                "exposure_time": self.request.exposure_time,
                "target_adu": self.request.target_adu,
                "interval_seconds": self.request.interval_seconds,
            },
            "timing": {
                "created_at": self.created_at.isoformat(),
                "started_at": self.started_at.isoformat() if self.started_at else None,
                "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            },
            "output_directory": self.output_directory,
        }

        # Save metadata file in calibration directory
        metadata_file = Path(self.output_directory) / f"calibration_metadata_{self.job_id}.json"
        import json

        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Saved calibration metadata to {metadata_file}")

    def pause(self):
        """Pause the calibration job"""
        self._is_paused = True
        logger.info(f"Paused calibration job {self.job_id}")

    def resume(self):
        """Resume the calibration job"""
        self._is_paused = False
        logger.info(f"Resumed calibration job {self.job_id}")

    def cancel(self):
        """Cancel the calibration job"""
        self._should_stop = True
        self.status = "cancelled"
        logger.info(f"Cancelled calibration job {self.job_id}")

    def get_status(self) -> CalibrationJobStatus:
        """Get current job status"""
        return CalibrationJobStatus(
            job_id=self.job_id,
            session_id=self.request.session_id,
            frame_type=self.request.frame_type,
            status=self.status,
            created_at=self.created_at,
            started_at=self.started_at,
            completed_at=self.completed_at,
            total_frames=self.total_frames,
            completed_frames=self.completed_frames,
            failed_frames=self.failed_frames,
            current_temperature=self.current_temperature,
            average_adu=self.average_adu,
            output_directory=self.output_directory,
            captured_files=self.captured_files,
            estimated_completion=self.estimated_completion,
            error_message=self.error_message,
        )


# API Router
router = APIRouter(prefix="/sessions", tags=["session-calibration"])

# Global manager instance
calibration_manager = None


def get_session_service() -> SessionService:
    """Dependency to get session service"""
    from app.api.session_api import session_service

    return session_service


def get_calibration_manager() -> SessionCalibrationManager:
    """Dependency to get calibration manager"""
    global calibration_manager
    if calibration_manager is None:
        session_service = get_session_service()
        camera_service = get_camera_service()
        calibration_manager = SessionCalibrationManager(session_service, camera_service)
    return calibration_manager


# API Endpoints
@router.post("/{session_id}/calibration/start", response_model=CalibrationResponse)
async def start_calibration_capture(
    session_id: str,
    request: CalibrationCaptureRequest,
    background_tasks: BackgroundTasks,
    manager: SessionCalibrationManager = Depends(get_calibration_manager),
):
    """Start calibration frame capture for a session"""

    # Override session_id in request to ensure consistency
    request.session_id = session_id

    try:
        job = manager.start_calibration_job(request)

        logger.info(f"Started calibration capture job {job.job_id} for session {session_id}")

        return CalibrationResponse(
            job_id=job.job_id,
            message=f"Started capturing {request.count} {request.frame_type.value} frames",
            status=job.get_status(),
        )

    except Exception as e:
        logger.error(f"Failed to start calibration capture: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start calibration: {str(e)}")


@router.get("/{session_id}/calibration/{job_id}/status", response_model=CalibrationJobStatus)
async def get_calibration_status(
    session_id: str,
    job_id: str,
    manager: SessionCalibrationManager = Depends(get_calibration_manager),
):
    """Get status of a calibration job"""

    if job_id not in manager.active_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    job = manager.active_jobs[job_id]
    if job.request.session_id != session_id:
        raise HTTPException(status_code=403, detail="Job does not belong to this session")

    return job.get_status()


@router.post("/{session_id}/calibration/{job_id}/pause")
async def pause_calibration(
    session_id: str,
    job_id: str,
    manager: SessionCalibrationManager = Depends(get_calibration_manager),
):
    """Pause a calibration job"""

    if job_id not in manager.active_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    job = manager.active_jobs[job_id]
    if job.request.session_id != session_id:
        raise HTTPException(status_code=403, detail="Job does not belong to this session")

    if job.status != "running":
        raise HTTPException(status_code=400, detail="Can only pause running jobs")

    job.pause()
    return {"message": "Calibration paused"}


@router.post("/{session_id}/calibration/{job_id}/resume")
async def resume_calibration(
    session_id: str,
    job_id: str,
    manager: SessionCalibrationManager = Depends(get_calibration_manager),
):
    """Resume a paused calibration job"""

    if job_id not in manager.active_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    job = manager.active_jobs[job_id]
    if job.request.session_id != session_id:
        raise HTTPException(status_code=403, detail="Job does not belong to this session")

    if job.status != "paused":
        raise HTTPException(status_code=400, detail="Can only resume paused jobs")

    job.resume()
    return {"message": "Calibration resumed"}


@router.post("/{session_id}/calibration/{job_id}/cancel")
async def cancel_calibration(
    session_id: str,
    job_id: str,
    manager: SessionCalibrationManager = Depends(get_calibration_manager),
):
    """Cancel a calibration job"""

    if job_id not in manager.active_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    job = manager.active_jobs[job_id]
    if job.request.session_id != session_id:
        raise HTTPException(status_code=403, detail="Job does not belong to this session")

    if job.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Job is already completed or cancelled")

    job.cancel()
    return {"message": "Calibration cancelled"}


@router.get("/{session_id}/calibration/jobs")
async def list_calibration_jobs(
    session_id: str,
    manager: SessionCalibrationManager = Depends(get_calibration_manager),
):
    """List all calibration jobs for a session"""

    session_jobs = {
        job_id: job.get_status() for job_id, job in manager.active_jobs.items() if job.request.session_id == session_id
    }

    return {"session_id": session_id, "jobs": session_jobs}


@router.get("/{session_id}/calibration/structure")
async def get_calibration_structure(
    session_id: str,
    session_service: SessionService = Depends(get_session_service),
    manager: SessionCalibrationManager = Depends(get_calibration_manager),
):
    """Get the calibration directory structure and file counts for a session"""

    try:
        # Verify session exists
        session = session_service.get_session(session_id)

        # Create calibration directories if they don't exist
        calibration_dirs = manager.create_calibration_directories(session_id)

        # Count files in each calibration directory
        structure = {}
        for frame_type, dir_path in calibration_dirs.items():
            files = list(dir_path.glob("*.cr2")) + list(dir_path.glob("*.CR2"))
            metadata_files = list(dir_path.glob("calibration_metadata_*.json"))

            structure[frame_type] = {
                "directory": str(dir_path),
                "file_count": len(files),
                "files": [f.name for f in files],
                "metadata_files": [f.name for f in metadata_files],
                "last_capture": max([f.stat().st_mtime for f in files]) if files else None,
            }

        return {"session_id": session_id, "session_name": session.name, "calibration_structure": structure}

    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to get calibration structure: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get calibration structure: {str(e)}")


# Calibration presets
@router.get("/calibration/presets")
async def get_calibration_presets():
    """Get predefined calibration frame presets"""

    presets = [
        {
            "name": "Complete Calibration Set",
            "description": "Full calibration: bias, darks for multiple exposures, flats",
            "estimated_duration": "45-60 minutes",
            "frames": [
                {"frame_type": "bias", "count": 50, "description": "Readout noise calibration"},
                {"frame_type": "dark", "count": 20, "exposure_time": "30s", "description": "30s dark frames"},
                {"frame_type": "dark", "count": 20, "exposure_time": "60s", "description": "60s dark frames"},
                {"frame_type": "dark", "count": 20, "exposure_time": "120s", "description": "120s dark frames"},
                {"frame_type": "flat", "count": 30, "target_adu": 30000, "description": "Flat field correction"},
            ],
        },
        {
            "name": "Session Darks Only",
            "description": "Dark frames matching your session exposure times",
            "estimated_duration": "20-30 minutes",
            "frames": [
                {
                    "frame_type": "dark",
                    "count": 20,
                    "exposure_time": "match_session",
                    "description": "Match session exposure",
                },
            ],
        },
        {
            "name": "Bias & Flats",
            "description": "Essential calibration without darks",
            "estimated_duration": "15-20 minutes",
            "frames": [
                {"frame_type": "bias", "count": 50, "description": "Readout noise calibration"},
                {"frame_type": "flat", "count": 30, "target_adu": 30000, "description": "Flat field correction"},
            ],
        },
        {
            "name": "Quick Bias Set",
            "description": "Just bias frames for basic calibration",
            "estimated_duration": "5-10 minutes",
            "frames": [
                {"frame_type": "bias", "count": 30, "description": "Basic readout noise calibration"},
            ],
        },
    ]

    return {"presets": presets}
