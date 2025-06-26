from fastapi import Depends
from app.api.base_router import BaseAPIRouter
from app.dependancies import get_session_service, get_camera_service
from app.models.session_models import (
    CreateSessionRequest,
    UpdateSessionRequest,
    SessionCaptureRequest,
)
from app.models.common_models import SuccessResponse
from app.services.session_service import SessionService, SessionNotFoundError
from app.services.camera_service import CameraService
from app.utils.response_helpers import create_success_response


class SessionAPIRouter(BaseAPIRouter):
    """Session API router with standardized responses"""
    
    def __init__(self):
        super().__init__(prefix="/sessions", tags=["sessions"])
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up all session API routes"""
        
        @self.router.post("/", response_model=SuccessResponse)
        async def create_session(
            request: CreateSessionRequest,
            service: SessionService = Depends(get_session_service)
        ):
            """Create a new imaging session"""
            return self.handle_create_operation(
                "session",
                service.create_session,
                name=request.name,
                target=request.target,
                capture_plan=request.capture_plan
            )
        
        @self.router.get("/", response_model=SuccessResponse)
        async def list_sessions(service: SessionService = Depends(get_session_service)):
            """List all sessions"""
            return self.handle_list_operation("sessions", service.list_sessions)
        
        @self.router.get("/{session_id}", response_model=SuccessResponse)
        async def get_session(
            session_id: str,
            service: SessionService = Depends(get_session_service)
        ):
            """Get a specific session by ID"""
            return self.handle_get_operation("session", service.get_session, session_id)
        
        @self.router.put("/{session_id}", response_model=SuccessResponse)
        async def update_session(
            session_id: str,
            request: UpdateSessionRequest,
            service: SessionService = Depends(get_session_service)
        ):
            """Update session metadata"""
            return self.handle_update_operation(
                "session",
                service.update_session,
                session_id,
                name=request.name,
                status=request.status,
                capture_plan=request.capture_plan
            )
        
        @self.router.delete("/{session_id}", response_model=SuccessResponse)
        async def delete_session(
            session_id: str,
            service: SessionService = Depends(get_session_service)
        ):
            """Delete a session and all its data"""
            return self.handle_delete_operation("session", service.delete_session, session_id)
        
        @self.router.post("/{session_id}/activate", response_model=SuccessResponse)
        async def activate_session(
            session_id: str,
            service: SessionService = Depends(get_session_service)
        ):
            """Set a session as the active session for captures"""
            return self.handle_operation(
                f"activate session {session_id}",
                service.set_active_session,
                session_id
            )
        
        @self.router.post("/deactivate", response_model=SuccessResponse)
        async def deactivate_session(service: SessionService = Depends(get_session_service)):
            """Clear the active session"""
            return self.handle_operation(
                "deactivate session",
                service.set_active_session,
                None
            )
        
        @self.router.post("/{session_id}/capture", response_model=SuccessResponse)
        async def capture_to_session(
            session_id: str,
            request: SessionCaptureRequest,
            session_service: SessionService = Depends(get_session_service),
            camera_service: CameraService = Depends(get_camera_service),
        ):
            """Capture an image directly to a specific session"""
            self.logger.info(f"Capturing image to session {session_id}")
            
            try:
                # Verify session exists
                session = session_service.get_session(session_id)
                
                # Get session capture directory
                captures_path = session_service.get_session_captures_path(session_id)
                
                # Generate image name if not provided
                capture_number = len(session.images) + 1
                image_name = request.image_name or f"{session.target.lower()}_{capture_number:03d}"
                
                # Capture image using camera service
                result = camera_service.capture(save_to_path=str(captures_path), image_name=image_name)
                
                if result is None:
                    raise Exception("Camera not connected")
                
                # Get file size
                from pathlib import Path
                file_path = Path(result["path"])
                file_size = file_path.stat().st_size if file_path.exists() else None
                
                # Add image to session
                session_service.add_image_to_session(
                    session_id=session_id,
                    filename=result["filename"],
                    size_bytes=file_size
                )
                
                # Generate static URL relative to projects root
                static_url = f"projects/{session_id}/captures/{result['filename']}"
                
                self.logger.info(f"Image captured to session {session_id}: {result['filename']}")
                
                return create_success_response(
                    message="Image captured successfully",
                    data={
                        "status": "captured",
                        "filename": result["filename"],
                        "session_id": session_id,
                        "capture_number": capture_number,
                        "timestamp": result["timestamp"],
                        "size_bytes": file_size,
                        "static_url": static_url,
                    }
                )
                
            except Exception as e:
                self.logger.error(f"Failed to capture to session {session_id}: {e}")
                raise e
        
        @self.router.get("/{session_id}/images", response_model=SuccessResponse)
        async def get_session_images(
            session_id: str,
            service: SessionService = Depends(get_session_service)
        ):
            """Get all images for a session"""
            return self.handle_get_operation(
                "session images",
                service.get_session,
                session_id
            )
        
        @self.router.get("/{session_id}/stats", response_model=SuccessResponse)
        async def get_session_statistics(
            session_id: str,
            service: SessionService = Depends(get_session_service)
        ):
            """Get session statistics"""
            return self.handle_get_operation(
                "session statistics",
                service.get_session,
                session_id
            )


# Create router instance
session_router = SessionAPIRouter().get_router() 