from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime


class ImageMetadata(BaseModel):
    """EXIF and basic metadata from image"""

    filename: str
    file_size_bytes: int
    image_width: int
    image_height: int
    created_at: datetime

    # Camera settings from EXIF
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    iso: Optional[int] = None
    aperture: Optional[str] = None
    shutter_speed: Optional[str] = None
    focal_length: Optional[str] = None

    # Additional EXIF data
    exposure_time: Optional[float] = None
    white_balance: Optional[str] = None
    flash: Optional[str] = None


class FocusAnalysis(BaseModel):
    """Focus quality analysis results"""

    focus_score: float = Field(..., description="Focus quality score (higher = better)")
    sharpness_score: float = Field(..., description="Overall image sharpness")
    focus_method: str = Field(default="laplacian", description="Analysis method used")

    # Detailed metrics
    contrast_score: Optional[float] = None
    edge_density: Optional[float] = None
    star_count: Optional[int] = None
    average_star_size: Optional[float] = None


class HistogramData(BaseModel):
    """Image histogram analysis"""

    red_histogram: List[int] = Field(..., description="Red channel histogram (256 bins)")
    green_histogram: List[int] = Field(..., description="Green channel histogram (256 bins)")
    blue_histogram: List[int] = Field(..., description="Blue channel histogram (256 bins)")
    luminance_histogram: List[int] = Field(..., description="Luminance histogram (256 bins)")

    # Statistics
    mean_brightness: float
    median_brightness: float
    std_brightness: float
    clipped_highlights: float = Field(..., description="Percentage of clipped highlights")
    clipped_shadows: float = Field(..., description="Percentage of clipped shadows")


class ImageStats(BaseModel):
    """Basic image statistics"""

    mean_value: float
    median_value: float
    std_deviation: float
    min_value: int
    max_value: int
    dynamic_range: float
    signal_to_noise_ratio: Optional[float] = None


class StarDetection(BaseModel):
    """Star detection results"""

    star_count: int
    average_star_brightness: float
    brightest_star_value: int
    star_positions: List[Dict[str, float]] = Field(default_factory=list, description="List of {x, y, brightness}")
    estimated_seeing: Optional[float] = Field(None, description="Estimated seeing in pixels")


class ImageAnalysisResult(BaseModel):
    """Complete image analysis results"""

    filename: str
    analyzed_at: datetime

    metadata: ImageMetadata
    focus_analysis: FocusAnalysis
    histogram: HistogramData
    stats: ImageStats
    star_detection: Optional[StarDetection] = None

    # Processing info
    analysis_duration_ms: float
    thumbnail_generated: bool = False
    thumbnail_path: Optional[str] = None


class AnalysisRequest(BaseModel):
    """Request for image analysis"""

    image_path: str = Field(..., description="Path to image file relative to projects or captures")
    generate_thumbnail: bool = Field(True, description="Generate thumbnail preview")
    detect_stars: bool = Field(False, description="Perform star detection (slower)")
    thumbnail_size: int = Field(400, description="Thumbnail max dimension")


class BatchAnalysisRequest(BaseModel):
    """Request for batch analysis of multiple images"""

    session_id: str = Field(..., description="Session ID to analyze")
    detect_stars: bool = Field(False, description="Perform star detection")
    generate_thumbnails: bool = Field(True, description="Generate thumbnails")
    force_reanalyze: bool = Field(False, description="Re-analyze already processed images")


class BatchAnalysisResponse(BaseModel):
    """Response for batch analysis"""

    session_id: str
    total_images: int
    analyzed_images: int
    skipped_images: int
    failed_images: int
    analysis_duration_ms: float
    results: List[ImageAnalysisResult]


class QuickStatsRequest(BaseModel):
    """Request for quick image statistics without full analysis"""

    image_path: str


class QuickStatsResponse(BaseModel):
    """Quick statistics response"""

    filename: str
    focus_score: float
    mean_brightness: float
    file_size_mb: float
    analysis_duration_ms: float
