import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS
import cv2

from app.models.image_analysis_models import (
    ImageMetadata,
    FocusAnalysis,
    HistogramData,
    ImageStats,
    StarDetection,
    ImageAnalysisResult,
)


logger = logging.getLogger(__name__)


class ImageAnalysisError(Exception):
    """Base exception for image analysis errors"""

    pass


class ImageAnalysisService:
    def __init__(self):
        self.projects_root = Path("projects")
        self.captures_root = Path("captures")

    def _get_image_path(self, relative_path: str) -> Path:
        """Resolve relative image path to absolute path"""
        path = Path(relative_path)

        # Try projects directory first
        projects_path = self.projects_root / path
        if projects_path.exists():
            return projects_path

        # Try captures directory
        captures_path = self.captures_root / path
        if captures_path.exists():
            return captures_path

        # Try as absolute path
        if path.is_absolute() and path.exists():
            return path

        raise ImageAnalysisError(f"Image not found: {relative_path}")

    def _extract_metadata(self, image_path: Path) -> ImageMetadata:
        """Extract EXIF metadata from image"""
        try:
            with Image.open(image_path) as img:
                # Basic image info
                width, height = img.size
                file_size = image_path.stat().st_size
                created_at = datetime.fromtimestamp(image_path.stat().st_mtime)

                # Initialize metadata
                metadata = ImageMetadata(
                    filename=image_path.name,
                    file_size_bytes=file_size,
                    image_width=width,
                    image_height=height,
                    created_at=created_at,
                )

                # Extract EXIF data if available
                exif_data = img.getexif()
                if exif_data:
                    # Map EXIF tags to our model fields
                    exif_mapping = {
                        "Make": "camera_make",
                        "Model": "camera_model",
                        "ISOSpeedRatings": "iso",
                        "FNumber": "aperture",
                        "ExposureTime": "exposure_time",
                        "FocalLength": "focal_length",
                        "WhiteBalance": "white_balance",
                        "Flash": "flash",
                    }

                    for tag_id, value in exif_data.items():
                        tag = TAGS.get(tag_id, tag_id)
                        if tag in exif_mapping:
                            field_name = exif_mapping[tag]

                            # Handle specific conversions
                            if tag == "FNumber" and isinstance(value, tuple):
                                metadata.aperture = f"f/{value[0] / value[1]:.1f}"
                            elif tag == "ExposureTime":
                                if isinstance(value, tuple):
                                    exposure_val = value[0] / value[1]
                                    metadata.exposure_time = exposure_val
                                    if exposure_val < 1:
                                        metadata.shutter_speed = f"1/{int(1 / exposure_val)}"
                                    else:
                                        metadata.shutter_speed = f"{exposure_val}s"
                                else:
                                    metadata.exposure_time = float(value)
                            elif tag == "FocalLength" and isinstance(value, tuple):
                                metadata.focal_length = f"{value[0] / value[1]:.1f}mm"
                            else:
                                setattr(metadata, field_name, value)

                return metadata

        except Exception as e:
            logger.error(f"Failed to extract metadata from {image_path}: {e}")
            raise ImageAnalysisError(f"Failed to extract metadata: {str(e)}")

    def _calculate_focus_score(self, image_array: np.ndarray) -> FocusAnalysis:
        """Calculate focus quality metrics"""
        try:
            # Convert to grayscale if needed
            if len(image_array.shape) == 3:
                gray = np.dot(image_array[..., :3], [0.2989, 0.5870, 0.1140])
            else:
                gray = image_array

            # Laplacian variance (primary focus metric)

            laplacian = cv2.Laplacian(gray.astype(np.uint8), cv2.CV_64F)
            focus_score = laplacian.var()

            # Additional metrics with OpenCV
            edges = cv2.Canny(gray.astype(np.uint8), 50, 150)
            edge_density = np.sum(edges > 0) / edges.size

            # Sobel gradient magnitude
            sobelx = cv2.Sobel(gray.astype(np.uint8), cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray.astype(np.uint8), cv2.CV_64F, 0, 1, ksize=3)
            sobel_magnitude = np.sqrt(sobelx**2 + sobely**2)
            sharpness_score = np.mean(sobel_magnitude)

            return FocusAnalysis(
                focus_score=focus_score,
                sharpness_score=sharpness_score,
                focus_method="laplacian_opencv",
                edge_density=edge_density,
            )

        except Exception as e:
            logger.error(f"Failed to calculate focus score: {e}")
            # Return default values
            return FocusAnalysis(focus_score=0.0, sharpness_score=0.0, focus_method="failed")

    def _calculate_histogram(self, image_array: np.ndarray) -> HistogramData:
        """Calculate image histogram and statistics"""
        try:
            if len(image_array.shape) == 3:
                # Color image
                red_hist = np.histogram(image_array[:, :, 0], bins=256, range=(0, 256))[0].tolist()
                green_hist = np.histogram(image_array[:, :, 1], bins=256, range=(0, 256))[0].tolist()
                blue_hist = np.histogram(image_array[:, :, 2], bins=256, range=(0, 256))[0].tolist()

                # Calculate luminance
                luminance = np.dot(image_array[..., :3], [0.2989, 0.5870, 0.1140])
            else:
                # Grayscale image
                gray_hist = np.histogram(image_array, bins=256, range=(0, 256))[0].tolist()
                red_hist = green_hist = blue_hist = gray_hist
                luminance = image_array

            # Luminance histogram
            lum_hist = np.histogram(luminance, bins=256, range=(0, 256))[0].tolist()

            # Statistics
            mean_brightness = np.mean(luminance)
            median_brightness = np.median(luminance)
            std_brightness = np.std(luminance)

            # Clipping analysis
            total_pixels = luminance.size
            clipped_highlights = np.sum(luminance >= 250) / total_pixels * 100
            clipped_shadows = np.sum(luminance <= 5) / total_pixels * 100

            return HistogramData(
                red_histogram=red_hist,
                green_histogram=green_hist,
                blue_histogram=blue_hist,
                luminance_histogram=lum_hist,
                mean_brightness=float(mean_brightness),
                median_brightness=float(median_brightness),
                std_brightness=float(std_brightness),
                clipped_highlights=float(clipped_highlights),
                clipped_shadows=float(clipped_shadows),
            )

        except Exception as e:
            logger.error(f"Failed to calculate histogram: {e}")
            raise ImageAnalysisError(f"Failed to calculate histogram: {str(e)}")

    def _calculate_stats(self, image_array: np.ndarray) -> ImageStats:
        """Calculate basic image statistics"""
        try:
            # Convert to grayscale for statistics
            if len(image_array.shape) == 3:
                gray = np.dot(image_array[..., :3], [0.2989, 0.5870, 0.1140])
            else:
                gray = image_array

            return ImageStats(
                mean_value=float(np.mean(gray)),
                median_value=float(np.median(gray)),
                std_deviation=float(np.std(gray)),
                min_value=int(np.min(gray)),
                max_value=int(np.max(gray)),
                dynamic_range=float(np.max(gray) - np.min(gray)),
            )

        except Exception as e:
            logger.error(f"Failed to calculate stats: {e}")
            raise ImageAnalysisError(f"Failed to calculate stats: {str(e)}")

    def _detect_stars(self, image_array: np.ndarray) -> Optional[StarDetection]:
        """Detect stars in the image (requires OpenCV)"""
        if not self._cv2_available:
            logger.warning("Star detection requires OpenCV")
            return None

        try:
            import cv2

            # Convert to grayscale
            if len(image_array.shape) == 3:
                gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
            else:
                gray = image_array

            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)

            # Threshold to find bright spots (stars)
            _, thresh = cv2.threshold(blurred, 0.7 * np.max(blurred), 255, cv2.THRESH_BINARY)

            # Find contours (star candidates)
            contours, _ = cv2.findContours(thresh.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            stars = []
            brightness_values = []

            for contour in contours:
                # Filter by area (remove noise and large objects)
                area = cv2.contourArea(contour)
                if 3 <= area <= 500:  # Reasonable star size range
                    # Get centroid
                    M = cv2.moments(contour)
                    if M["m00"] != 0:
                        cx = M["m10"] / M["m00"]
                        cy = M["m01"] / M["m00"]

                        # Get brightness at star center
                        x, y = int(cx), int(cy)
                        if 0 <= x < gray.shape[1] and 0 <= y < gray.shape[0]:
                            brightness = float(gray[y, x])
                            brightness_values.append(brightness)

                            stars.append({"x": float(cx), "y": float(cy), "brightness": brightness})

            return StarDetection(
                star_count=len(stars),
                average_star_brightness=float(np.mean(brightness_values)) if brightness_values else 0.0,
                brightest_star_value=int(np.max(brightness_values)) if brightness_values else 0,
                star_positions=stars[:50],  # Limit to first 50 stars
            )

        except Exception as e:
            logger.error(f"Failed to detect stars: {e}")
            return None

    def _generate_thumbnail(self, image_path: Path, thumbnail_size: int = 400) -> Optional[str]:
        """Generate thumbnail image"""
        try:
            # Determine thumbnail path
            thumb_dir = image_path.parent / "previews"
            thumb_dir.mkdir(exist_ok=True)
            thumb_path = thumb_dir / f"{image_path.stem}_thumb.jpg"

            # Generate thumbnail
            with Image.open(image_path) as img:
                # Convert to RGB if needed
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")

                # Create thumbnail
                img.thumbnail((thumbnail_size, thumbnail_size), Image.Resampling.LANCZOS)
                img.save(thumb_path, "JPEG", quality=85, optimize=True)

            # Return relative path from projects root
            return str(thumb_path.relative_to(self.projects_root))

        except Exception as e:
            logger.error(f"Failed to generate thumbnail for {image_path}: {e}")
            return None

    def analyze_image(
        self, image_path: str, generate_thumbnail: bool = True, detect_stars: bool = False, thumbnail_size: int = 400
    ) -> ImageAnalysisResult:
        """Perform complete image analysis"""
        start_time = time.time()

        try:
            # Resolve image path
            full_path = self._get_image_path(image_path)
            logger.info(f"Analyzing image: {full_path}")

            # Load image
            with Image.open(full_path) as img:
                # Convert to RGB array
                if img.mode != "RGB":
                    img = img.convert("RGB")
                image_array = np.array(img)

            # Extract metadata
            metadata = self._extract_metadata(full_path)

            # Perform analysis
            focus_analysis = self._calculate_focus_score(image_array)
            histogram = self._calculate_histogram(image_array)
            stats = self._calculate_stats(image_array)

            # Optional star detection
            star_detection = None
            if detect_stars:
                star_detection = self._detect_stars(image_array)

            # Optional thumbnail generation
            thumbnail_path = None
            thumbnail_generated = False
            if generate_thumbnail:
                thumbnail_path = self._generate_thumbnail(full_path, thumbnail_size)
                thumbnail_generated = thumbnail_path is not None

            # Calculate processing time
            analysis_duration = (time.time() - start_time) * 1000

            result = ImageAnalysisResult(
                filename=full_path.name,
                analyzed_at=datetime.now(),
                metadata=metadata,
                focus_analysis=focus_analysis,
                histogram=histogram,
                stats=stats,
                star_detection=star_detection,
                analysis_duration_ms=analysis_duration,
                thumbnail_generated=thumbnail_generated,
                thumbnail_path=thumbnail_path,
            )

            logger.info(f"Analysis completed in {analysis_duration:.1f}ms - Focus: {focus_analysis.focus_score:.1f}")
            return result

        except Exception as e:
            logger.error(f"Failed to analyze image {image_path}: {e}")
            raise ImageAnalysisError(f"Failed to analyze image: {str(e)}")

    def quick_focus_score(self, image_path: str) -> float:
        """Quick focus score calculation without full analysis"""
        try:
            full_path = self._get_image_path(image_path)

            # Load smaller version for speed
            with Image.open(full_path) as img:
                # Resize to 800px max dimension for speed
                img.thumbnail((800, 800))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                image_array = np.array(img)

            focus_analysis = self._calculate_focus_score(image_array)
            return focus_analysis.focus_score

        except Exception as e:
            logger.error(f"Failed to calculate quick focus score for {image_path}: {e}")
            return 0.0
