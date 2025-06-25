import logging
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.session_models import (
    CreateSessionRequest,
    CreateSessionResponse,
    SessionListResponse,
    UpdateSessionRequest,
    SessionCaptureRequest,
    SessionCaptureResponse,
    Session,
)
from app.services.session_service import SessionService, SessionNotFoundError
from app.services.camera_service import CameraService
from app.dependancies import get_camera_service
from app.exceptions.camera_exceptions import CameraNotConnectedError, CameraCaptureError


logger = logging.getLogger(__name__)

# Create session service instance
session_service = SessionService()

router = APIRouter(
    prefix="/sessions",
    tags=["sessions"],
)


def get_session_service() -> SessionService:
    """Dependency to get session service"""
    return session_service


@router.post("/", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest, service: SessionService = Depends(get_session_service)):
    """Create a new imaging session"""
    logger.info(f"Creating new session: {request.name} for target {request.target}")

    try:
        session = service.create_session(name=request.name, target=request.target, capture_plan=request.capture_plan)

        return CreateSessionResponse(session=session, message=f"Session '{session.name}' created successfully")

    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create session: {str(e)}"
        )


@router.get("/", response_model=SessionListResponse)
async def list_sessions(service: SessionService = Depends(get_session_service)):
    """List all sessions"""
    try:
        sessions = service.list_sessions()
        active_session_id = service.get_active_session_id()

        return SessionListResponse(sessions=sessions, active_session_id=active_session_id)

    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list sessions: {str(e)}"
        )


@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: str, service: SessionService = Depends(get_session_service)):
    """Get a specific session by ID"""
    try:
        session = service.get_session(session_id)
        return session

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to get session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get session: {str(e)}"
        )


@router.put("/{session_id}", response_model=Session)
async def update_session(
    session_id: str, request: UpdateSessionRequest, service: SessionService = Depends(get_session_service)
):
    """Update session metadata"""
    try:
        session = service.update_session(
            session_id=session_id, name=request.name, status=request.status, capture_plan=request.capture_plan
        )
        return session

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to update session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update session: {str(e)}"
        )


@router.delete("/{session_id}")
async def delete_session(session_id: str, service: SessionService = Depends(get_session_service)):
    """Delete a session and all its data"""
    try:
        service.delete_session(session_id)
        return {"message": f"Session {session_id} deleted successfully"}

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to delete session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete session: {str(e)}"
        )


@router.post("/{session_id}/activate")
async def activate_session(session_id: str, service: SessionService = Depends(get_session_service)):
    """Set a session as the active session for captures"""
    try:
        service.set_active_session(session_id)
        return {"message": f"Session {session_id} is now active"}

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to activate session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to activate session: {str(e)}"
        )


@router.post("/deactivate")
async def deactivate_session(service: SessionService = Depends(get_session_service)):
    """Clear the active session"""
    try:
        service.set_active_session(None)
        return {"message": "No active session"}

    except Exception as e:
        logger.error(f"Failed to deactivate session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to deactivate session: {str(e)}"
        )


@router.post("/{session_id}/capture", response_model=SessionCaptureResponse)
async def capture_to_session(
    session_id: str,
    request: SessionCaptureRequest,
    session_service: SessionService = Depends(get_session_service),
    camera_service: CameraService = Depends(get_camera_service),
):
    """Capture an image directly to a specific session"""
    logger.info(f"Capturing image to session {session_id}")

    try:
        # Verify session exists
        session = session_service.get_session(session_id)

        # Get session capture directory
        captures_path = session_service.get_session_captures_path(session_id)

        # Generate image name if not provided
        capture_number = len(session.images) + 1
        if request.image_name:
            image_name = request.image_name
        else:
            image_name = f"{session.target.lower()}_{capture_number:03d}"

        # Capture image using camera service
        result = camera_service.capture(save_to_path=str(captures_path), image_name=image_name)

        if result is None:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")

        # Get file size
        file_path = Path(result["path"])
        file_size = file_path.stat().st_size if file_path.exists() else None

        # Add image to session
        session_service.add_image_to_session(session_id=session_id, filename=result["filename"], size_bytes=file_size)

        # Generate static URL relative to projects root
        static_url = f"projects/{session_id}/captures/{result['filename']}"

        logger.info(f"Image captured to session {session_id}: {result['filename']}")

        return SessionCaptureResponse(
            status="captured",
            filename=result["filename"],
            session_id=session_id,
            capture_number=capture_number,
            timestamp=result["timestamp"],
            size_bytes=file_size,
            static_url=static_url,
        )

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except CameraNotConnectedError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Camera not connected")
    except CameraCaptureError as e:
        logger.error(f"Camera capture error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Capture failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during session capture: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during capture"
        )


@router.get("/{session_id}/images")
async def get_session_images(session_id: str, service: SessionService = Depends(get_session_service)):
    """Get list of images in a session"""
    try:
        session = service.get_session(session_id)
        return {"session_id": session_id, "images": session.images, "statistics": session.statistics}

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to get session images {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get session images: {str(e)}"
        )


@router.get("/{session_id}/stats")
async def get_session_statistics(session_id: str, service: SessionService = Depends(get_session_service)):
    """Get session statistics"""
    try:
        session = service.get_session(session_id)
        return {
            "session_id": session_id,
            "statistics": session.statistics,
            "capture_plan": session.capture_plan,
            "progress": {
                "completed": session.statistics.successful_captures,
                "target": session.capture_plan.target_count,
                "percentage": (
                    (session.statistics.successful_captures / session.capture_plan.target_count * 100)
                    if session.capture_plan.target_count > 0
                    else 0
                ),
            },
        }

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to get session statistics {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get session statistics: {str(e)}"
        )


# Addition to app/services/session_service.py


def _create_session_directories(self, session_id: str):
    """Create the session directory structure including calibration subdirectories"""
    session_path = self._get_session_path(session_id)
    session_path.mkdir(exist_ok=True)

    # Core session directories
    (session_path / "captures").mkdir(exist_ok=True)
    (session_path / "previews").mkdir(exist_ok=True)
    (session_path / "analysis").mkdir(exist_ok=True)

    # Calibration frame directories
    calibration_root = session_path / "calibration"
    calibration_root.mkdir(exist_ok=True)

    # Create subdirectories for each calibration frame type
    (calibration_root / "dark").mkdir(exist_ok=True)
    (calibration_root / "bias").mkdir(exist_ok=True)
    (calibration_root / "flat").mkdir(exist_ok=True)
    (calibration_root / "flat_dark").mkdir(exist_ok=True)

    # Create metadata directory for calibration job info
    (calibration_root / "metadata").mkdir(exist_ok=True)

    logger.info(f"Created session directory structure for {session_id}")


def get_session_calibration_summary(self, session_id: str) -> dict[str, any]:
    """Get a summary of calibration frames for a session"""
    session_path = self._get_session_path(session_id)
    calibration_path = session_path / "calibration"

    if not calibration_path.exists():
        return {"total_frames": 0, "frame_types": {}}

    summary = {"total_frames": 0, "frame_types": {}, "last_capture": None, "total_size_bytes": 0}

    frame_types = ["dark", "bias", "flat", "flat_dark"]
    latest_time = None

    for frame_type in frame_types:
        type_path = calibration_path / frame_type
        if type_path.exists():
            # Count CR2 files
            cr2_files = list(type_path.glob("*.cr2")) + list(type_path.glob("*.CR2"))

            # Get file info
            total_size = sum(f.stat().st_size for f in cr2_files if f.exists())

            if cr2_files:
                latest_file_time = max(f.stat().st_mtime for f in cr2_files)
                if latest_time is None or latest_file_time > latest_time:
                    latest_time = latest_file_time

            summary["frame_types"][frame_type] = {
                "count": len(cr2_files),
                "size_bytes": total_size,
                "files": [f.name for f in cr2_files],
            }

            summary["total_frames"] += len(cr2_files)
            summary["total_size_bytes"] += total_size

    if latest_time:
        summary["last_capture"] = datetime.fromtimestamp(latest_time).isoformat()

    return summary
