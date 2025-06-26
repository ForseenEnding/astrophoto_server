from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from app.models.common_models import (
    BaseResponse,
    ErrorResponse,
    SuccessResponse,
    StatusResponse,
    ConnectionResponse,
    PaginatedResponse,
)


def create_success_response(
    message: str, 
    data: Optional[Dict[str, Any]] = None
) -> SuccessResponse:
    """Create a standardized success response"""
    return SuccessResponse(
        message=message,
        data=data
    )


def create_error_response(
    message: str,
    error_code: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> ErrorResponse:
    """Create a standardized error response"""
    return ErrorResponse(
        message=message,
        error_code=error_code,
        details=details
    )


def create_status_response(
    status: str,
    connected: bool,
    details: Optional[Dict[str, Any]] = None
) -> StatusResponse:
    """Create a standardized status response"""
    return StatusResponse(
        message=f"Status: {status}",
        status=status,
        connected=connected,
        details=details
    )


def create_connection_response(
    connected: bool,
    message: str,
    retry_after: Optional[int] = None
) -> ConnectionResponse:
    """Create a standardized connection response"""
    return ConnectionResponse(
        success=connected,
        connected=connected,
        message=message,
        retry_after=retry_after
    )


def create_paginated_response(
    data: List[Dict[str, Any]],
    total: int,
    page: int,
    per_page: int
) -> PaginatedResponse:
    """Create a standardized paginated response"""
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        message=f"Retrieved {len(data)} items",
        data=data,
        total=total,
        page=page,
        per_page=per_page,
        has_next=page < total_pages,
        has_prev=page > 1
    )


def raise_http_exception(
    status_code: int,
    detail: str,
    error_code: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None
) -> None:
    """Raise a standardized HTTP exception"""
    raise HTTPException(
        status_code=status_code,
        detail=detail,
        headers=headers
    )


def handle_service_error(
    error: Exception,
    operation: str,
    default_status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
) -> None:
    """Handle service errors and raise appropriate HTTP exceptions"""
    error_message = f"Failed to {operation}: {str(error)}"
    
    # Map specific exceptions to appropriate HTTP status codes
    if "not found" in str(error).lower():
        status_code = status.HTTP_404_NOT_FOUND
    elif "already exists" in str(error).lower() or "conflict" in str(error).lower():
        status_code = status.HTTP_409_CONFLICT
    elif "not connected" in str(error).lower() or "unavailable" in str(error).lower():
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif "busy" in str(error).lower():
        status_code = status.HTTP_409_CONFLICT
    elif "timeout" in str(error).lower():
        status_code = status.HTTP_408_REQUEST_TIMEOUT
    elif "bad request" in str(error).lower() or "invalid" in str(error).lower():
        status_code = status.HTTP_400_BAD_REQUEST
    else:
        status_code = default_status_code
    
    raise_http_exception(status_code, error_message) 