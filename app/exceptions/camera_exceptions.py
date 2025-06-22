import gphoto2 as gp
from typing import Optional

from contextlib import contextmanager


# Enhanced exception hierarchy
class CameraError(Exception):
    def __init__(self, message: str, code: int = None, original_error: Exception = None):
        super().__init__(message)
        self.code = code
        self.original_error = original_error


class CameraBusyError(CameraError):
    """Raised when the camera is busy."""

    pass


class CameraNotConnectedError(CameraError):
    """Raised when no camera is found."""

    pass


class CameraUSBError(CameraError):
    """Raised for USB-related issues when communicating with the camera."""

    pass


class CameraTimeoutError(CameraError):
    """Raised when a camera operation times out."""

    pass


class CameraConfigError(CameraError):
    """Raised for issues related to bad parameters or configuration."""

    pass


class CameraUnsupportedError(CameraError):
    """Raised when an unsupported operation is attempted."""

    pass


class CameraIOError(CameraError):
    """Raised for generic I/O errors."""

    pass


class CameraDataError(CameraError):
    """Raised when data from the camera is corrupted."""

    pass


class CameraFileNotFoundError(CameraError):
    """Raised when a requested file is not found on the camera."""

    pass


class CameraPathError(CameraError):
    """Raised when a file path is invalid or not absolute."""

    pass


class CameraCaptureError(CameraError):
    """Raise when image capture fails"""

    pass


class CameraPreviewError(CameraError):
    """Raised when preview capture fails"""

    pass


ERROR_MAP = {
    gp.GP_ERROR_MODEL_NOT_FOUND: CameraNotConnectedError,
    gp.GP_ERROR_CAMERA_BUSY: CameraBusyError,
    gp.GP_ERROR_IO_USB_CLAIM: CameraUSBError,
    gp.GP_ERROR_IO_USB_FIND: CameraUSBError,
    gp.GP_ERROR_TIMEOUT: CameraTimeoutError,
    gp.GP_ERROR_BAD_PARAMETERS: CameraConfigError,
    gp.GP_ERROR_NOT_SUPPORTED: CameraUnsupportedError,
    gp.GP_ERROR_IO: CameraIOError,
    gp.GP_ERROR_CORRUPTED_DATA: CameraDataError,
    gp.GP_ERROR_FILE_NOT_FOUND: CameraFileNotFoundError,
    gp.GP_ERROR_PATH_NOT_ABSOLUTE: CameraPathError,
}


def map_error(gphoto_error: gp.GPhoto2Error, operation: Optional[str] = None) -> CameraError:
    """
    Map a gphoto2 error to a custom domain-specific exception.
    """
    error_class = ERROR_MAP.get(gphoto_error.code, CameraError)
    message = str(gphoto_error)
    if operation:
        message = f"Failed to {operation}: {message}"
    return error_class(message, code=gphoto_error.code, original_error=gphoto_error)


@contextmanager
def wrap_gphoto2_error(operation: str):
    """Context manager for gphoto error handling"""
    try:
        yield
    except gp.GPhoto2Error as e:
        raise map_error(e, operation)
