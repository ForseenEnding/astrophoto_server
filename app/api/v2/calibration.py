from fastapi import APIRouter, Depends, BackgroundTasks
from app.api.base_router import BaseAPIRouter
from app.dependancies import get_camera_service, get_session_service
from app.models.calibration_models import (
    CalibrationCaptureRequest,
    CalibrationResponse,
    CalibrationJobList,
    CalibrationStructure,
    CalibrationPresetList,
    CalibrationPreset,
    CalibrationFrameType,
    CalibrationJobStatus,
)
from app.models.common_models import SuccessResponse
from app.services.camera_service import CameraService
from app.services.session_service import SessionService
from app.utils.response_helpers import create_success_response, raise_http_exception, status
from datetime import datetime


class CalibrationAPIRouter(BaseAPIRouter):
    """Calibration API router with standardized responses"""
    
    def __init__(self):
        super().__init__(prefix="/calibration", tags=["calibration"])
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up all calibration API routes"""
        
        @self.router.post("/{session_id}/start", response_model=CalibrationResponse)
        async def start_calibration_capture(
            session_id: str,
            request: CalibrationCaptureRequest,
            background_tasks: BackgroundTasks,
            camera_service: CameraService = Depends(get_camera_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """Start calibration capture for a session"""
            self.logger.info(f"Starting calibration capture for session {session_id}")
            
            try:
                # Verify session exists
                session = session_service.get_session(session_id)
                
                # Check if camera is connected
                if not camera_service.is_connected():
                    raise_http_exception(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Camera not connected"
                    )
                
                # Create calibration directories
                calibration_dirs = self._create_calibration_directories(session_id, session_service)
                
                # Generate job ID and status
                job_id = f"cal_{session_id}_{request.frame_type.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                
                # Create job status
                job_status = CalibrationJobStatus(
                    job_id=job_id,
                    session_id=session_id,
                    frame_type=request.frame_type,
                    status="pending",
                    created_at=datetime.now(),
                    started_at=None,
                    completed_at=None,
                    total_frames=request.count,
                    completed_frames=0,
                    failed_frames=0,
                    current_temperature=None,
                    average_adu=None,
                    output_directory=str(calibration_dirs[request.frame_type.value]),
                    captured_files=[],
                    estimated_completion=None,
                    error_message=None,
                )
                
                return CalibrationResponse(
                    success=True,
                    message=f"Calibration capture started: {request.frame_type.value} frames",
                    timestamp=datetime.now(),
                    job_id=job_id,
                    status=job_status
                )
                
            except Exception as e:
                self.logger.error(f"Failed to start calibration capture: {e}")
                raise e
        
        @self.router.get("/{session_id}/jobs", response_model=CalibrationJobList)
        async def list_calibration_jobs(
            session_id: str,
            session_service: SessionService = Depends(get_session_service),
        ):
            """List all calibration jobs for a session"""
            try:
                # Verify session exists
                session = session_service.get_session(session_id)
                
                # Placeholder - implement actual job listing logic
                jobs = []
                
                return CalibrationJobList(
                    success=True,
                    message=f"Retrieved calibration jobs for session {session_id}",
                    timestamp=datetime.now(),
                    jobs=jobs,
                    session_id=session_id
                )
                
            except Exception as e:
                self.logger.error(f"Failed to list calibration jobs: {e}")
                raise e
        
        @self.router.get("/{session_id}/structure", response_model=CalibrationStructure)
        async def get_calibration_structure(
            session_id: str,
            session_service: SessionService = Depends(get_session_service),
        ):
            """Get calibration directory structure for a session"""
            try:
                # Verify session exists
                session = session_service.get_session(session_id)
                
                # Create calibration directories
                calibration_dirs = self._create_calibration_directories(session_id, session_service)
                
                # Count files in each directory
                frame_counts = {}
                total_files = 0
                
                for frame_type, dir_path in calibration_dirs.items():
                    if dir_path.exists():
                        file_count = len(list(dir_path.glob("*")))
                        frame_counts[frame_type] = file_count
                        total_files += file_count
                    else:
                        frame_counts[frame_type] = 0
                
                return CalibrationStructure(
                    success=True,
                    message=f"Retrieved calibration structure for session {session_id}",
                    timestamp=datetime.now(),
                    session_id=session_id,
                    calibration_dirs={k: str(v) for k, v in calibration_dirs.items()},
                    frame_counts=frame_counts,
                    total_files=total_files
                )
                
            except Exception as e:
                self.logger.error(f"Failed to get calibration structure: {e}")
                raise e
        
        @self.router.get("/presets", response_model=CalibrationPresetList)
        async def get_calibration_presets():
            """Get available calibration presets"""
            presets = [
                CalibrationPreset(
                    name="dark_frames",
                    description="Standard dark frames for light pollution reduction",
                    frame_type=CalibrationFrameType.DARK,
                    count=20,
                    exposure_time="30s",
                    interval_seconds=2.0,
                    delay_before_start=0
                ),
                CalibrationPreset(
                    name="bias_frames",
                    description="Bias frames for sensor readout noise",
                    frame_type=CalibrationFrameType.BIAS,
                    count=50,
                    interval_seconds=1.0,
                    delay_before_start=0
                ),
                CalibrationPreset(
                    name="flat_frames",
                    description="Flat frames for vignetting correction",
                    frame_type=CalibrationFrameType.FLAT,
                    count=30,
                    target_adu=25000,
                    interval_seconds=2.0,
                    delay_before_start=0
                ),
                CalibrationPreset(
                    name="flat_dark_frames",
                    description="Dark frames for flat frame calibration",
                    frame_type=CalibrationFrameType.FLAT_DARK,
                    count=20,
                    exposure_time="5s",
                    interval_seconds=2.0,
                    delay_before_start=0
                ),
            ]
            
            return CalibrationPresetList(
                success=True,
                message="Retrieved calibration presets",
                timestamp=datetime.now(),
                presets=presets
            )
    
    def _create_calibration_directories(self, session_id: str, session_service: SessionService) -> dict:
        """Create calibration subdirectories within session folder"""
        session_path = session_service._get_session_path(session_id)
        
        calibration_dirs = {}
        for frame_type in CalibrationFrameType:
            cal_dir = session_path / "calibration" / frame_type.value
            cal_dir.mkdir(parents=True, exist_ok=True)
            calibration_dirs[frame_type.value] = cal_dir
        
        return calibration_dirs


# Create router instance
calibration_router = CalibrationAPIRouter().get_router() 