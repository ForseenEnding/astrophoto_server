import logging
import time
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from app.models.image_analysis_models import (
    AnalysisRequest,
    ImageAnalysisResult,
    QuickStatsRequest,
    QuickStatsResponse,
    BatchAnalysisRequest,
    BatchAnalysisResponse,
)
from app.services.image_analysis_service import ImageAnalysisService, ImageAnalysisError
from app.services.session_service import SessionService, SessionNotFoundError
from app.dependancies import get_session_service
from PIL import Image
import numpy as np


logger = logging.getLogger(__name__)

# Create image analysis service instance
image_analysis_service = ImageAnalysisService()

router = APIRouter(
    prefix="/analysis",
    tags=["analysis"],
)


def get_image_analysis_service() -> ImageAnalysisService:
    """Dependency to get image analysis service"""
    return image_analysis_service


@router.post("/image", response_model=ImageAnalysisResult)
async def analyze_single_image(
    request: AnalysisRequest, service: ImageAnalysisService = Depends(get_image_analysis_service)
):
    """Analyze a single image for focus, histogram, and statistics"""
    logger.info(f"Analyzing image: {request.image_path}")

    try:
        result = service.analyze_image(
            image_path=request.image_path,
            generate_thumbnail=request.generate_thumbnail,
            detect_stars=request.detect_stars,
            thumbnail_size=request.thumbnail_size,
        )

        return result

    except ImageAnalysisError as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during image analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during image analysis"
        )


@router.post("/quick-stats", response_model=QuickStatsResponse)
async def get_quick_stats(
    request: QuickStatsRequest, service: ImageAnalysisService = Depends(get_image_analysis_service)
):
    """Get quick image statistics for fast feedback"""
    logger.info(f"Getting quick stats for: {request.image_path}")

    try:
        start_time = time.time()

        image_path = service._get_image_path(request.image_path)
        file_size_mb = image_path.stat().st_size / (1024 * 1024)

        # Quick focus score
        focus_score = service.quick_focus_score(request.image_path)

        mean_brightness = 0.0
        try:
            with Image.open(image_path) as img:
                img.thumbnail((200, 200))  # Very small for speed
                if img.mode != "RGB":
                    img = img.convert("RGB")
                array = np.array(img)
                mean_brightness = float(np.mean(array))
        except Exception:
            pass

        analysis_duration = (time.time() - start_time) * 1000

        return QuickStatsResponse(
            filename=image_path.name,
            focus_score=focus_score,
            mean_brightness=mean_brightness,
            file_size_mb=file_size_mb,
            analysis_duration_ms=analysis_duration,
        )

    except ImageAnalysisError as e:
        logger.error(f"Quick stats failed: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during quick stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during quick stats"
        )


@router.post("/session/{session_id}/batch", response_model=BatchAnalysisResponse)
async def analyze_session_batch(
    session_id: str,
    request: BatchAnalysisRequest,
    background_tasks: BackgroundTasks,
    analysis_service: ImageAnalysisService = Depends(get_image_analysis_service),
    session_service: SessionService = Depends(get_session_service),
):
    """Analyze all images in a session"""
    logger.info(f"Starting batch analysis for session: {session_id}")

    try:
        # Verify session exists
        session = session_service.get_session(session_id)

        start_time = time.time()
        results = []
        analyzed_count = 0
        skipped_count = 0
        failed_count = 0

        # Get all images in session captures directory
        captures_path = session_service.get_session_captures_path(session_id)
        image_files = [
            f for f in captures_path.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".cr2", ".raw", ".nef", ".arw"]
        ]

        total_images = len(image_files)

        for image_file in image_files:
            try:
                # Check if already analyzed (unless force reanalyze)
                analysis_file = captures_path.parent / "analysis" / f"{image_file.stem}_analysis.json"

                if analysis_file.exists() and not request.force_reanalyze:
                    logger.debug(f"Skipping already analyzed image: {image_file.name}")
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
                logger.error(f"Failed to analyze {image_file.name}: {e}")
                failed_count += 1

        analysis_duration = (time.time() - start_time) * 1000

        logger.info(
            f"Batch analysis completed: {analyzed_count} analyzed, {skipped_count} skipped, {failed_count} failed"
        )

        return BatchAnalysisResponse(
            session_id=session_id,
            total_images=total_images,
            analyzed_images=analyzed_count,
            skipped_images=skipped_count,
            failed_images=failed_count,
            analysis_duration_ms=analysis_duration,
            results=results,
        )

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Batch analysis failed for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Batch analysis failed: {str(e)}"
        )


@router.get("/session/{session_id}/focus-trend")
async def get_session_focus_trend(session_id: str, session_service: SessionService = Depends(get_session_service)):
    """Get focus trend data for a session"""
    try:
        session = session_service.get_session(session_id)

        # Extract focus scores and timestamps
        focus_data = []
        for i, image in enumerate(session.images):
            if image.focus_score is not None:
                focus_data.append(
                    {
                        "image_number": i + 1,
                        "filename": image.filename,
                        "focus_score": image.focus_score,
                        "captured_at": image.captured_at.isoformat(),
                        "timestamp": image.captured_at.timestamp(),
                    }
                )

        # Calculate focus statistics
        focus_scores = [item["focus_score"] for item in focus_data]
        focus_stats = {}

        if focus_scores:
            import numpy as np

            focus_stats = {
                "mean": float(np.mean(focus_scores)),
                "median": float(np.median(focus_scores)),
                "std": float(np.std(focus_scores)),
                "min": float(np.min(focus_scores)),
                "max": float(np.max(focus_scores)),
                "trend": (
                    "improving"
                    if len(focus_scores) > 1 and focus_scores[-1] > focus_scores[0]
                    else "declining" if len(focus_scores) > 1 else "stable"
                ),
            }

        return {
            "session_id": session_id,
            "focus_data": focus_data,
            "statistics": focus_stats,
            "total_images": len(focus_data),
        }

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to get focus trend for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get focus trend: {str(e)}"
        )


@router.get("/session/{session_id}/best-images")
async def get_best_images(
    session_id: str,
    limit: int = 10,
    sort_by: str = "focus_score",
    session_service: SessionService = Depends(get_session_service),
):
    """Get the best images from a session based on analysis metrics"""
    try:
        session = session_service.get_session(session_id)

        # Filter images with analysis data
        analyzed_images = [img for img in session.images if img.focus_score is not None]

        # Sort by specified metric
        if sort_by == "focus_score":
            sorted_images = sorted(analyzed_images, key=lambda x: x.focus_score or 0, reverse=True)
        elif sort_by == "file_size":
            sorted_images = sorted(analyzed_images, key=lambda x: x.size_bytes or 0, reverse=True)
        else:
            sorted_images = analyzed_images

        # Limit results
        best_images = sorted_images[:limit]

        return {
            "session_id": session_id,
            "sort_by": sort_by,
            "total_analyzed": len(analyzed_images),
            "returned_count": len(best_images),
            "images": [
                {
                    "filename": img.filename,
                    "focus_score": img.focus_score,
                    "size_bytes": img.size_bytes,
                    "captured_at": img.captured_at.isoformat(),
                    "preview_path": img.preview_path,
                    "static_url": f"projects/{session_id}/captures/{img.filename}",
                }
                for img in best_images
            ],
        }

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to get best images for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get best images: {str(e)}"
        )


@router.get("/session/{session_id}/analysis/{filename}")
async def get_image_analysis(
    session_id: str, filename: str, session_service: SessionService = Depends(get_session_service)
):
    """Get detailed analysis results for a specific image"""
    try:

        # Verify session exists
        session_service.get_session(session_id)

        # Load analysis file
        from pathlib import Path
        import json

        analysis_file = Path("projects") / session_id / "analysis" / f"{Path(filename).stem}_analysis.json"

        if not analysis_file.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis not found for {filename}")

        with open(analysis_file, "r") as f:
            analysis_data = json.load(f)

        return analysis_data

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis for {filename} in session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get image analysis: {str(e)}"
        )


@router.delete("/session/{session_id}/analysis")
async def clear_session_analysis(session_id: str, session_service: SessionService = Depends(get_session_service)):
    """Clear all analysis data for a session"""
    try:
        # Verify session exists
        session_service.get_session(session_id)

        # Remove analysis directory
        from pathlib import Path
        import shutil

        analysis_dir = Path("projects") / session_id / "analysis"
        if analysis_dir.exists():
            shutil.rmtree(analysis_dir)
            analysis_dir.mkdir(exist_ok=True)

        # Clear focus scores from session
        session = session_service.get_session(session_id)
        for image in session.images:
            image.focus_score = None
        session_service._save_session(session)

        return {"message": f"Analysis data cleared for session {session_id}"}

    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    except Exception as e:
        logger.error(f"Failed to clear analysis for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to clear analysis: {str(e)}"
        )
