import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional
from uuid import uuid4
from pathlib import Path

from app.models.bulk_capture_models import BulkCaptureRequest, BulkCaptureStatus
from app.services.camera_service import CameraService
from app.services.session_service import SessionService
from app.utils.logging_config import get_logger


logger = get_logger(__name__)


class BulkCaptureJob:
    """Represents a bulk capture job with state management"""
    
    def __init__(
        self, 
        job_id: str, 
        request: BulkCaptureRequest, 
        camera_service: CameraService, 
        session_service: SessionService
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
                                session_id=self.request.session_id, 
                                filename=result["filename"], 
                                size_bytes=file_size
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
                    f"Bulk capture job {self.job_id} completed: "
                    f"{self.successful_captures} successful, "
                    f"{self.failed_captures} failed"
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
        if self.job_id in BulkCaptureService.active_jobs:
            del BulkCaptureService.active_jobs[self.job_id]

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


class BulkCaptureService:
    """Service for managing bulk capture operations"""
    
    active_jobs: Dict[str, BulkCaptureJob] = {}

    def __init__(self, camera_service: CameraService, session_service: SessionService):
        self.camera_service = camera_service
        self.session_service = session_service

    def start_job(self, request: BulkCaptureRequest) -> BulkCaptureJob:
        """Start a new bulk capture job"""
        job_id = str(uuid4())
        
        job = BulkCaptureJob(job_id, request, self.camera_service, self.session_service)
        self.active_jobs[job_id] = job
        
        # Start background task
        asyncio.create_task(job.run())
        
        logger.info(f"Started bulk capture job {job_id}")
        return job

    def get_job(self, job_id: str) -> Optional[BulkCaptureJob]:
        """Get a job by ID"""
        return self.active_jobs.get(job_id)

    def list_jobs(self) -> list[BulkCaptureStatus]:
        """List all active jobs"""
        return [job.get_status() for job in self.active_jobs.values()]

    def pause_job(self, job_id: str) -> bool:
        """Pause a job"""
        job = self.get_job(job_id)
        if job:
            job.pause()
            return True
        return False

    def resume_job(self, job_id: str) -> bool:
        """Resume a job"""
        job = self.get_job(job_id)
        if job:
            job.resume()
            return True
        return False

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job"""
        job = self.get_job(job_id)
        if job:
            job.cancel()
            return True
        return False 