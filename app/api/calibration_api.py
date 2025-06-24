# /app/api/calibration_api.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class CalibrationFrameType(str, Enum):
    DARK = "dark"  # Dark frames - sensor noise at specific temp/exposure
    BIAS = "bias"  # Bias frames - readout noise (shortest exposure)
    FLAT = "flat"  # Flat field frames - vignetting/dust correction
    FLAT_DARK = "flat_dark"  # Dark frames matching flat field exposure times


class CalibrationRequest(BaseModel):
    frame_type: CalibrationFrameType
    count: int = Field(gt=0, le=500, description="Number of frames to capture")
    session_id: Optional[str] = None

    # Frame-specific settings
    exposure_time: Optional[str] = None  # Required for darks and flat darks
    iso: Optional[str] = None
    temperature_target: Optional[float] = None  # Target sensor temperature

    # Flat field specific
    target_adu: Optional[int] = Field(None, ge=10000, le=50000, description="Target ADU level for flats")

    # Naming and organization
    base_name: Optional[str] = None
    save_path: Optional[str] = None

    # Timing
    interval_seconds: float = Field(default=1.0, ge=0.1, le=60)
    delay_before_start: float = Field(default=0, ge=0, le=3600)


class CalibrationJobStatus(BaseModel):
    job_id: str
    frame_type: CalibrationFrameType
    status: str  # pending, running, paused, completed, failed, cancelled
    progress: Dict[str, Any]
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None
    error_message: Optional[str] = None

    # Calibration specific
    total_frames: int
    completed_frames: int
    failed_frames: int
    current_exposure: Optional[str] = None
    current_temperature: Optional[float] = None
    average_adu: Optional[float] = None  # For flat fields

    # File paths
    output_directory: str
    captured_files: List[str] = []
    session_id: Optional[str] = None


class CalibrationResponse(BaseModel):
    job_id: str
    message: str
    status: CalibrationJobStatus


class CalibrationFrameSet(BaseModel):
    """A complete set of calibration frames for a session"""

    session_id: str
    created_at: datetime
    temperature_range: Optional[Dict[str, float]] = None  # min, max, avg

    # Frame counts by type
    dark_frames: List[Dict[str, Any]] = []  # [{"exposure": "30s", "count": 20, "files": [...]}]
    bias_frames: Dict[str, Any] = {}  # {"count": 50, "files": [...]}
    flat_frames: List[Dict[str, Any]] = []  # [{"filter": "L", "count": 20, "files": [...]}]
    flat_dark_frames: List[Dict[str, Any]] = []  # [{"exposure": "1s", "count": 20, "files": [...]}]


router = APIRouter(prefix="/calibration", tags=["calibration"])

# Active calibration jobs
active_calibration_jobs: Dict[str, "CalibrationJob"] = {}


class CalibrationJob:
    def __init__(self, request: CalibrationRequest, camera_service, session_service=None):
        self.job_id = str(uuid.uuid4())
        self.request = request
        self.camera_service = camera_service
        self.session_service = session_service

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

        # Setup output directory
        self.output_directory = self._setup_output_directory()

        # Control flags
        self._should_stop = False
        self._is_paused = False
        self._task = None

    def _setup_output_directory(self) -> str:
        """Create organized directory structure for calibration frames"""
        base_path = Path(self.request.save_path or "calibration_frames")

        # Create date-based structure: calibration_frames/2025-06-23/darks/
        date_str = datetime.now().strftime("%Y-%m-%d")
        frame_type_dir = base_path / date_str / self.request.frame_type.value

        if self.request.session_id:
            frame_type_dir = frame_type_dir / f"session_{self.request.session_id}"

        frame_type_dir.mkdir(parents=True, exist_ok=True)
        return str(frame_type_dir)

    async def run(self):
        """Execute the calibration capture sequence"""
        try:
            self.status = "running"
            self.started_at = datetime.now()

            # Pre-flight checks
            await self._validate_camera_ready()

            # Frame type specific setup
            await self._setup_frame_type()

            # Wait for start delay
            if self.request.delay_before_start > 0:
                logger.info(f"Waiting {self.request.delay_before_start}s before starting calibration")
                await asyncio.sleep(self.request.delay_before_start)

            # Main capture loop
            await self._capture_loop()

            # Finalize
            if not self._should_stop:
                self.status = "completed"
                self.completed_at = datetime.now()
                await self._finalize_calibration_set()

        except Exception as e:
            self.status = "failed"
            self.error_message = str(e)
            logger.error(f"Calibration job {self.job_id} failed: {e}")
        finally:
            # Cleanup camera settings
            await self._cleanup_camera_settings()

    async def _validate_camera_ready(self):
        """Ensure camera is connected and ready"""
        status = await self.camera_service.get_status()
        if not status.get("connected"):
            raise Exception("Camera must be connected to start calibration")

    async def _setup_frame_type(self):
        """Configure camera settings for specific frame type"""
        settings = {}

        if self.request.frame_type == CalibrationFrameType.DARK:
            # Dark frames: specified exposure, cover lens/telescope
            if not self.request.exposure_time:
                raise Exception("Exposure time required for dark frames")
            settings["shutter_speed"] = self.request.exposure_time

        elif self.request.frame_type == CalibrationFrameType.BIAS:
            # Bias frames: shortest possible exposure
            settings["shutter_speed"] = await self._get_shortest_exposure()

        elif self.request.frame_type == CalibrationFrameType.FLAT:
            # Flat frames: even illumination, target ADU level
            if self.request.target_adu:
                settings["shutter_speed"] = await self._calculate_flat_exposure()
            elif not self.request.exposure_time:
                raise Exception("Either target_adu or exposure_time required for flat frames")
            else:
                settings["shutter_speed"] = self.request.exposure_time

        elif self.request.frame_type == CalibrationFrameType.FLAT_DARK:
            # Flat dark frames: same exposure as flats, covered
            if not self.request.exposure_time:
                raise Exception("Exposure time required for flat dark frames")
            settings["shutter_speed"] = self.request.exposure_time

        # Apply common settings
        if self.request.iso:
            settings["iso"] = self.request.iso

        # Apply camera settings
        if settings:
            await self.camera_service.update_settings(settings)

    async def _capture_loop(self):
        """Main loop for capturing calibration frames"""
        for frame_num in range(self.total_frames):
            if self._should_stop:
                break

            # Handle pause
            while self._is_paused and not self._should_stop:
                await asyncio.sleep(0.1)

            if self._should_stop:
                break

            try:
                # Generate filename
                filename = self._generate_filename(frame_num + 1)

                # Capture frame
                await self._capture_single_frame(filename)

                self.completed_frames += 1
                self.captured_files.append(filename)

                # Update progress
                self._update_progress()

                # Wait between frames (except for last frame)
                if frame_num < self.total_frames - 1:
                    await asyncio.sleep(self.request.interval_seconds)

            except Exception as e:
                self.failed_frames += 1
                logger.error(f"Failed to capture frame {frame_num + 1}: {e}")

                # Continue with remaining frames unless critical error
                if "camera disconnected" in str(e).lower():
                    raise e

    async def _capture_single_frame(self, filename: str):
        """Capture a single calibration frame"""
        # Update current temperature if available
        status = await self.camera_service.get_status()
        if "temperature" in status:
            self.current_temperature = status["temperature"]

        # Capture with specific filename and path
        capture_request = {
            "save_to_path": self.output_directory,
            "image_name": filename,
            "frame_type": self.request.frame_type.value,
        }

        result = await self.camera_service.capture(capture_request)

        # For flat frames, check ADU level
        if self.request.frame_type == CalibrationFrameType.FLAT and self.request.target_adu:
            await self._check_flat_adu_level(result.get("file_path"))

    async def _check_flat_adu_level(self, file_path: str):
        """Check if flat frame ADU level is within target range"""
        try:
            # This would integrate with your image analysis service
            # adu_stats = await self.image_analysis_service.get_adu_statistics(file_path)
            # self.average_adu = adu_stats.get('mean_adu')

            # For now, just log
            logger.info(f"Flat frame captured: {file_path}")
        except Exception as e:
            logger.warning(f"Could not check ADU level for {file_path}: {e}")

    def _generate_filename(self, frame_number: int) -> str:
        """Generate standardized filename for calibration frame"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        base_name = self.request.base_name or f"{self.request.frame_type.value}_frame"

        # Include relevant parameters in filename
        params = []
        if self.request.exposure_time:
            # Convert exposure to filename-safe format (e.g., "1/60" -> "1-60s")
            exp_safe = self.request.exposure_time.replace("/", "-").replace('"', "s")
            params.append(f"exp{exp_safe}")

        if self.request.iso:
            params.append(f"iso{self.request.iso}")

        if self.current_temperature:
            params.append(f"temp{self.current_temperature:.1f}C")

        param_str = "_".join(params)
        if param_str:
            return f"{base_name}_{param_str}_{timestamp}_f{frame_number:03d}"
        else:
            return f"{base_name}_{timestamp}_f{frame_number:03d}"

    def _update_progress(self):
        """Update estimated completion time"""
        if self.completed_frames > 0 and self.started_at:
            elapsed = (datetime.now() - self.started_at).total_seconds()
            avg_time_per_frame = elapsed / self.completed_frames
            remaining_frames = self.total_frames - self.completed_frames
            eta_seconds = remaining_frames * avg_time_per_frame
            self.estimated_completion = datetime.now() + timedelta(seconds=eta_seconds)

    async def _finalize_calibration_set(self):
        """Create metadata file for the calibration set"""
        metadata = {
            "job_id": self.job_id,
            "frame_type": self.request.frame_type.value,
            "total_frames": self.total_frames,
            "completed_frames": self.completed_frames,
            "failed_frames": self.failed_frames,
            "captured_files": self.captured_files,
            "settings": {
                "exposure_time": self.request.exposure_time,
                "iso": self.request.iso,
                "target_adu": self.request.target_adu,
            },
            "timing": {
                "created_at": self.created_at.isoformat(),
                "started_at": self.started_at.isoformat() if self.started_at else None,
                "completed_at": self.completed_at.isoformat() if self.completed_at else None,
                "interval_seconds": self.request.interval_seconds,
            },
            "temperature_stats": {
                "current": self.current_temperature,
                # Could add min/max/avg temperature tracking
            },
        }

        # Save metadata file
        metadata_file = Path(self.output_directory) / f"calibration_metadata_{self.job_id}.json"
        import json

        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)

    async def _cleanup_camera_settings(self):
        """Reset camera to previous state"""
        # This would restore previous camera settings
        logger.info("Cleaning up camera settings after calibration")

    async def _get_shortest_exposure(self) -> str:
        """Get the shortest available exposure time for bias frames"""
        # This would query camera capabilities
        return "1/4000"  # Default fast shutter speed

    async def _calculate_flat_exposure(self) -> str:
        """Calculate exposure time to achieve target ADU for flat frames"""
        # This would do a test exposure and calculate optimal settings
        # For now, return a reasonable default
        return "1/60"

    def get_status(self) -> CalibrationJobStatus:
        """Get current job status"""
        progress = {
            "completed_frames": self.completed_frames,
            "total_frames": self.total_frames,
            "failed_frames": self.failed_frames,
            "percentage": (self.completed_frames / self.total_frames) * 100 if self.total_frames > 0 else 0,
        }

        return CalibrationJobStatus(
            job_id=self.job_id,
            frame_type=self.request.frame_type,
            status=self.status,
            progress=progress,
            created_at=self.created_at,
            started_at=self.started_at,
            completed_at=self.completed_at,
            estimated_completion=self.estimated_completion,
            error_message=self.error_message,
            total_frames=self.total_frames,
            completed_frames=self.completed_frames,
            failed_frames=self.failed_frames,
            current_exposure=self.request.exposure_time,
            current_temperature=self.current_temperature,
            average_adu=self.average_adu,
            output_directory=self.output_directory,
            captured_files=self.captured_files,
            session_id=self.request.session_id,
        )

    def pause(self):
        """Pause the calibration job"""
        self._is_paused = True

    def resume(self):
        """Resume the calibration job"""
        self._is_paused = False

    def cancel(self):
        """Cancel the calibration job"""
        self._should_stop = True
        self.status = "cancelled"


# API Endpoints
@router.post("/start", response_model=CalibrationResponse)
async def start_calibration(
    request: CalibrationRequest,
    background_tasks: BackgroundTasks,
    camera_service=Depends(lambda: None),  # Inject your camera service
):
    """Start a calibration frame capture sequence"""

    # Create and start calibration job
    job = CalibrationJob(request, camera_service)
    active_calibration_jobs[job.job_id] = job

    # Start background task
    job._task = asyncio.create_task(job.run())

    logger.info(f"Started calibration job {job.job_id} for {request.frame_type.value} frames")

    return CalibrationResponse(
        job_id=job.job_id,
        message=f"Calibration started: {request.count} {request.frame_type.value} frames",
        status=job.get_status(),
    )


@router.get("/{job_id}/status", response_model=CalibrationJobStatus)
async def get_calibration_status(job_id: str):
    """Get status of a calibration job"""
    if job_id not in active_calibration_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    return active_calibration_jobs[job_id].get_status()


@router.post("/{job_id}/pause")
async def pause_calibration(job_id: str):
    """Pause a running calibration job"""
    if job_id not in active_calibration_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    job = active_calibration_jobs[job_id]
    if job.status != "running":
        raise HTTPException(status_code=400, detail="Can only pause running jobs")

    job.pause()
    return {"message": "Calibration paused"}


@router.post("/{job_id}/resume")
async def resume_calibration(job_id: str):
    """Resume a paused calibration job"""
    if job_id not in active_calibration_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    job = active_calibration_jobs[job_id]
    if job.status != "paused":
        raise HTTPException(status_code=400, detail="Can only resume paused jobs")

    job.resume()
    return {"message": "Calibration resumed"}


@router.post("/{job_id}/cancel")
async def cancel_calibration(job_id: str):
    """Cancel a calibration job"""
    if job_id not in active_calibration_jobs:
        raise HTTPException(status_code=404, detail="Calibration job not found")

    job = active_calibration_jobs[job_id]
    if job.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Job is already completed or cancelled")

    job.cancel()
    return {"message": "Calibration cancelled"}


@router.get("/jobs")
async def list_calibration_jobs():
    """List all active calibration jobs"""
    jobs = {}
    for job_id, job in active_calibration_jobs.items():
        jobs[job_id] = job.get_status()

    return {"jobs": jobs}


@router.get("/presets")
async def get_calibration_presets():
    """Get common calibration frame presets"""
    return {
        "presets": [
            {
                "name": "Standard Dark Set",
                "description": "20 dark frames for each exposure time used in session",
                "frame_type": "dark",
                "count": 20,
                "exposure_times": ["30s", "60s", "120s", "300s"],
            },
            {
                "name": "Bias Frame Set",
                "description": "50 bias frames for readout noise calibration",
                "frame_type": "bias",
                "count": 50,
            },
            {
                "name": "L Filter Flats",
                "description": "20 flat field frames for luminance filter",
                "frame_type": "flat",
                "count": 20,
                "target_adu": 30000,
            },
            {
                "name": "RGB Filter Flats",
                "description": "15 flat frames each for R, G, B filters",
                "frame_type": "flat",
                "count": 15,
                "target_adu": 25000,
                "filters": ["R", "G", "B"],
            },
        ]
    }


@router.post("/batch")
async def start_calibration_batch(requests: List[CalibrationRequest], background_tasks: BackgroundTasks):
    """Start multiple calibration sequences in order"""
    job_ids = []

    for request in requests:
        job = CalibrationJob(request, None)  # Inject camera service
        active_calibration_jobs[job.job_id] = job
        job_ids.append(job.job_id)

    # Start first job, others will be queued
    # Implementation would handle sequential execution

    return {"message": f"Started calibration batch with {len(requests)} sequences", "job_ids": job_ids}
