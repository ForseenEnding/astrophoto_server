from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime


class BaseResponse(BaseModel):
    """Base response model for all API endpoints"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Human-readable message")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")


class ErrorResponse(BaseResponse):
    """Standardized error response model"""
    success: bool = Field(default=False)
    error_code: Optional[str] = Field(None, description="Machine-readable error code")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")


class SuccessResponse(BaseResponse):
    """Standardized success response model"""
    success: bool = Field(default=True)
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")


class PaginatedResponse(BaseResponse):
    """Standardized paginated response model"""
    success: bool = Field(default=True)
    data: List[Dict[str, Any]] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_prev: bool = Field(..., description="Whether there are previous pages")


class StatusResponse(BaseResponse):
    """Standardized status response model"""
    success: bool = Field(default=True)
    status: str = Field(..., description="Current status")
    connected: bool = Field(..., description="Whether the service is connected")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional status details")


class ConnectionResponse(BaseResponse):
    """Standardized connection response model"""
    success: bool = Field(..., description="Whether the connection was successful")
    connected: bool = Field(..., description="Current connection state")
    message: str = Field(..., description="Connection status message")
    retry_after: Optional[int] = Field(None, description="Seconds to wait before retry") 