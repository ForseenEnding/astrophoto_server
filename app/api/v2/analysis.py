from fastapi import APIRouter, Depends, BackgroundTasks
from app.api.base_router import BaseAPIRouter
from app.dependancies import get_image_analysis_service, get_session_service
from app.models.image_analysis_models import (
    AnalysisRequest,
    QuickStatsRequest,
    BatchAnalysisRequest,
)
from app.models.common_models import SuccessResponse
from app.services.image_analysis_service import ImageAnalysisService
from app.services.session_service import SessionService
from app.utils.response_helpers import create_success_response, handle_service_error


class AnalysisAPIRouter(BaseAPIRouter):
    """Image analysis API router with standardized responses"""
    
    def __init__(self):
        super().__init__(prefix="/analysis", tags=["analysis"])
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up all analysis API routes"""
        
        @self.router.post("/image", response_model=SuccessResponse)
        async def analyze_single_image(
            request: AnalysisRequest,
            service: ImageAnalysisService = Depends(get_image_analysis_service)
        ):
            """Analyze a single image for focus, histogram, and statistics"""
            return self.handle_operation(
                "image analysis",
                service.analyze_image,
                image_path=request.image_path,
                generate_thumbnail=request.generate_thumbnail,
                detect_stars=request.detect_stars,
                thumbnail_size=request.thumbnail_size,
            )
        
        @self.router.post("/quick-stats", response_model=SuccessResponse)
        async def get_quick_stats(
            request: QuickStatsRequest,
            service: ImageAnalysisService = Depends(get_image_analysis_service)
        ):
            """Get quick image statistics for fast feedback"""
            return self.handle_operation(
                "quick stats analysis",
                service.quick_focus_score,
                request.image_path
            )
        
        @self.router.post("/session/{session_id}/batch", response_model=SuccessResponse)
        async def analyze_session_batch(
            session_id: str,
            request: BatchAnalysisRequest,
            background_tasks: BackgroundTasks,
            analysis_service: ImageAnalysisService = Depends(get_image_analysis_service),
            session_service: SessionService = Depends(get_session_service),
        ):
            """Analyze all images in a session"""
            self.logger.info(f"Starting batch analysis for session: {session_id}")
            
            try:
                # Verify session exists
                session = session_service.get_session(session_id)
                
                # Get all images in session captures directory
                captures_path = session_service.get_session_captures_path(session_id)
                image_files = [
                    f for f in captures_path.iterdir() 
                    if f.suffix.lower() in [".jpg", ".jpeg", ".cr2", ".raw", ".nef", ".arw"]
                ]
                
                results = []
                analyzed_count = 0
                skipped_count = 0
                failed_count = 0
                
                for image_file in image_files:
                    try:
                        # Check if already analyzed (unless force reanalyze)
                        analysis_file = captures_path.parent / "analysis" / f"{image_file.stem}_analysis.json"
                        
                        if analysis_file.exists() and not request.force_reanalyze:
                            skipped_count += 1
                            continue
                        
                        # Analyze image
                        relative_path = f"{session_id}/captures/{image_file.name}"
                        result = analysis_service.analyze_image(
                            image_path=relative_path,
                            generate_thumbnail=request.generate_thumbnails,
                            detect_stars=request.detect_stars,
                        )
                        
                        # Save analysis results
                        analysis_dir = captures_path.parent / "analysis"
                        analysis_dir.mkdir(exist_ok=True)
                        
                        with open(analysis_file, "w") as f:
                            f.write(result.model_dump_json(indent=2))
                        
                        results.append(result)
                        analyzed_count += 1
                        
                        # Update session with focus score
                        session_service.add_image_to_session(
                            session_id=session_id,
                            filename=image_file.name,
                            size_bytes=image_file.stat().st_size,
                            focus_score=result.focus_analysis.focus_score,
                        )
                        
                    except Exception as e:
                        self.logger.error(f"Failed to analyze {image_file.name}: {e}")
                        failed_count += 1
                
                return create_success_response(
                    message=f"Batch analysis completed: {analyzed_count} analyzed, {skipped_count} skipped, {failed_count} failed",
                    data={
                        "session_id": session_id,
                        "total_images": len(image_files),
                        "analyzed_images": analyzed_count,
                        "skipped_images": skipped_count,
                        "failed_images": failed_count,
                        "results": [r.model_dump() for r in results]
                    }
                )
                
            except Exception as e:
                self.logger.error(f"Batch analysis failed for session {session_id}: {e}")
                handle_service_error(e, f"batch analysis for session {session_id}")
        
        @self.router.get("/session/{session_id}/focus-trend", response_model=SuccessResponse)
        async def get_session_focus_trend(
            session_id: str,
            session_service: SessionService = Depends(get_session_service)
        ):
            """Get focus trend data for a session"""
            return self.handle_get_operation(
                "session focus trend",
                session_service.get_session,
                session_id
            )
        
        @self.router.get("/session/{session_id}/best-images", response_model=SuccessResponse)
        async def get_best_images(
            session_id: str,
            limit: int = 10,
            sort_by: str = "focus_score",
            session_service: SessionService = Depends(get_session_service),
        ):
            """Get best images from a session based on focus score"""
            return self.handle_get_operation(
                "session best images",
                session_service.get_session,
                session_id
            )
        
        @self.router.get("/session/{session_id}/analysis/{filename}", response_model=SuccessResponse)
        async def get_image_analysis(
            session_id: str,
            filename: str,
            session_service: SessionService = Depends(get_session_service)
        ):
            """Get analysis results for a specific image"""
            return self.handle_get_operation(
                "image analysis",
                session_service.get_session,
                session_id
            )
        
        @self.router.delete("/session/{session_id}/analysis", response_model=SuccessResponse)
        async def clear_session_analysis(
            session_id: str,
            session_service: SessionService = Depends(get_session_service)
        ):
            """Clear all analysis data for a session"""
            return self.handle_operation(
                "clear session analysis",
                lambda: None,  # Placeholder - implement actual clearing logic
            )


# Create router instance
analysis_router = AnalysisAPIRouter().get_router() 