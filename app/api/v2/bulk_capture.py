from fastapi import APIRouter, Depends, BackgroundTasks
from app.api.base_router import BaseAPIRouter
from app.dependancies import get_camera_service, get_session_service
from app.models.bulk_capture_models import (
    BulkCaptureRequest,
    BulkCaptureResponse,
    BulkCaptureJobList,
)
from app.models.common_models import SuccessResponse
from app.services.bulk_capture_service import BulkCaptureService
from app.services.camera_service import CameraService
from app.services.session_service import SessionService
from app.utils.response_helpers import create_success_response, raise_http_exception, status
from datetime import datetime


class BulkCaptureAPIRouter(BaseAPIRouter):
    """Bulk capture API router with standardized responses"""
    
    def __init__(self):
        super().__init__(prefix="/bulk-capture", tags=["bulk-capture"])
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up all bulk capture API routes"""
        
        @self.router.post("/start", response_model=BulkCaptureResponse)
        async def start_bulk_capture(
            request: BulkCaptureRequest,
            background_tasks: BackgroundTasks,
            camera_service: CameraService = Depends(get_camera_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """Start a bulk capture sequence"""
            self.logger.info(f"Starting bulk capture: {request.count} images")
            
            try:
                # Check if camera is connected
                if not camera_service.is_connected():
                    raise_http_exception(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Camera not connected"
                    )
                
                # Verify session exists if specified
                if request.session_id:
                    session_service.get_session(request.session_id)
                
                # Create bulk capture service and start job
                bulk_service = BulkCaptureService(camera_service, session_service)
                job = bulk_service.start_job(request)
                
                return BulkCaptureResponse(
                    success=True,
                    message=f"Bulk capture started: {request.count} images",
                    timestamp=job.started_at,
                    job_id=job.job_id,
                    status=job.get_status()
                )
                
            except Exception as e:
                self.logger.error(f"Failed to start bulk capture: {e}")
                raise e
        
        @self.router.get("/{job_id}/status", response_model=BulkCaptureResponse)
        async def get_bulk_capture_status(
            job_id: str,
            camera_service: CameraService = Depends(get_camera_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """Get status of a bulk capture job"""
            bulk_service = BulkCaptureService(camera_service, session_service)
            job = bulk_service.get_job(job_id)
            
            if not job:
                raise_http_exception(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Bulk capture job {job_id} not found"
                )
            
            return BulkCaptureResponse(
                success=True,
                message=f"Bulk capture job {job_id} status",
                timestamp=job.started_at,
                job_id=job_id,
                status=job.get_status()
            )
        
        @self.router.post("/{job_id}/pause", response_model=SuccessResponse)
        async def pause_bulk_capture(
            job_id: str,
            camera_service: CameraService = Depends(get_camera_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """Pause a bulk capture job"""
            bulk_service = BulkCaptureService(camera_service, session_service)
            
            if bulk_service.pause_job(job_id):
                return create_success_response(f"Bulk capture job {job_id} paused")
            else:
                raise_http_exception(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Bulk capture job {job_id} not found"
                )
        
        @self.router.post("/{job_id}/resume", response_model=SuccessResponse)
        async def resume_bulk_capture(
            job_id: str,
            camera_service: CameraService = Depends(get_camera_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """Resume a bulk capture job"""
            bulk_service = BulkCaptureService(camera_service, session_service)
            
            if bulk_service.resume_job(job_id):
                return create_success_response(f"Bulk capture job {job_id} resumed")
            else:
                raise_http_exception(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Bulk capture job {job_id} not found"
                )
        
        @self.router.post("/{job_id}/cancel", response_model=SuccessResponse)
        async def cancel_bulk_capture(
            job_id: str,
            camera_service: CameraService = Depends(get_camera_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """Cancel a bulk capture job"""
            bulk_service = BulkCaptureService(camera_service, session_service)
            
            if bulk_service.cancel_job(job_id):
                return create_success_response(f"Bulk capture job {job_id} cancelled")
            else:
                raise_http_exception(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Bulk capture job {job_id} not found"
                )
        
        @self.router.get("/jobs", response_model=BulkCaptureJobList)
        async def list_bulk_capture_jobs(
            camera_service: CameraService = Depends(get_camera_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """List all bulk capture jobs"""
            bulk_service = BulkCaptureService(camera_service, session_service)
            jobs = bulk_service.list_jobs()
            
            active_count = len([j for j in jobs if j.status in ["running", "paused"]])
            completed_count = len([j for j in jobs if j.status in ["completed", "cancelled", "error"]])
            
            # Get timestamp from first job if available, otherwise use current time
            timestamp = datetime.now()
            if bulk_service.active_jobs:
                first_job = next(iter(bulk_service.active_jobs.values()))
                if first_job:
                    timestamp = first_job.started_at
            
            return BulkCaptureJobList(
                success=True,
                message=f"Retrieved {len(jobs)} bulk capture jobs",
                timestamp=timestamp,
                jobs=jobs,
                active_count=active_count,
                completed_count=completed_count,
                total_count=len(jobs)
            )


# Create router instance
bulk_capture_router = BulkCaptureAPIRouter().get_router() 