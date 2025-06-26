import subprocess
import gphoto2 as gp
import logging
import time
import threading
from enum import IntEnum
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Any
from app.exceptions.camera_exceptions import (
    CameraError,
    CameraNotConnectedError,
    CameraPreviewError,
    CameraCaptureError,
    map_error,
    wrap_gphoto2_error,
)
from wrapt import synchronized


# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("logs/camera_service.log"), logging.StreamHandler()],
)

logger = logging.getLogger(__name__)


class CameraServiceConfig:
    class WidgetType(IntEnum):
        GP_WIDGET_WINDOW = 0
        GP_WIDGET_SECTION = 1
        GP_WIDGET_TEXT = 2
        GP_WIDGET_RANGE = 3
        GP_WIDGET_TOGGLE = 4
        GP_WIDGET_RADIO = 5
        GP_WIDGET_MENU = 6
        GP_WIDGET_BUTTON = 7
        GP_WIDGET_DATE = 8

    def __init__(self, widget: gp.CameraWidget):
        """
        Initialize CameraConfig with metadata from a camera widget.
        """
        self.widget = widget
        self.id = widget.get_id()
        self.name = widget.get_name()
        self.type = self.WidgetType(widget.get_type())

        parent = self._default_on_except(widget.get_parent, None)
        self.parent_id = parent.get_id() if parent else -1

        root = self._default_on_except(widget.get_root, None)
        self.root_id = root.get_id() if root else -1

        self.label = self._default_on_except(widget.get_label, None)
        self.children_ids = [child.get_id() for child in self._default_on_except(widget.get_children, [])]
        self.read_only = self._default_on_except(self.widget.get_readonly, False)
        self.value = self._default_on_except(self.widget.get_value, None)
        self.choices = self._get_choices(self.widget)

    def _default_on_except(self, delegate, default):
        """
        Return the result of the delegate call or a default value on exception.
        """
        try:
            return delegate()
        except gp.GPhoto2Error as e:
            logger.debug(f"[{self.name}] Using default for {delegate.__name__} due to: {e}")
            return default

    def _get_choices(self, widget):
        """
        Get selectable choices if widget supports them.
        """
        if self.type in [
            self.WidgetType.GP_WIDGET_MENU,
            self.WidgetType.GP_WIDGET_RADIO,
        ]:
            try:
                return [widget.get_choice(i) for i in range(widget.count_choices())]
            except gp.GPhoto2Error as e:
                logger.warning(f"Failed to get choices for widget {self.name}: {e}")
        return []

    def __repr__(self):
        return f"<CameraServiceConfig name={self.name} type={self.type.name} id={self.id} value={self.value}>"


class CameraService:
    _lock = threading.RLock()

    def __init__(self):
        logger.debug("__init()__")
        self._camera: Optional[gp.Camera] = None

    def _ensure_connected(self) -> bool:
        logger.debug("_ensure_connected()")
        if not self._camera:
            logger.error("No camera connected.")
            raise CameraNotConnectedError("Camera not connected to service")

    @synchronized(_lock)
    @wrap_gphoto2_error("camera.connect")
    def connect(self) -> bool:
        logger.debug("connect()")
        logger.info("Connecting to camera...")
        try:
            self._camera = gp.Camera()
            self._camera.init()
            logger.info("Camera connected successfully.")
            return True
        except CameraError as e:
            logger.error(f"Failed to connect to camera: {e}")
            self._camera = None
            raise e
        except Exception as e:
            logger.error(f"Failed to connect to camera: {e}")
            self._camera = None
            raise e

    @synchronized(_lock)
    @wrap_gphoto2_error("camera.disconnect")
    def disconnect(self) -> bool:
        logger.debug("disconnect()")
        logger.info("Disconnecting from camera...")
        if self._camera:
            try:
                self._camera.exit()
                self._camera = None
                logger.info("Camera disconnected successfully.")
            except gp.GPhoto2Error as e:
                logger.error(f"Failed to disconnect camera: {e}")
                raise map_error(e)
        else:
            logger.warning("No camera to disconnect.")
            self._camera = None
        return True

    def is_connected(self) -> bool:
        logger.debug("is_connected()")
        return self._camera is not None

    @synchronized(_lock)
    @wrap_gphoto2_error("camera.preview")
    def preview(self) -> bytes:
        logger.debug("preview()")
        logger.info("Capturing camera preview...")

        try:
            # Fail-fast if camera is not connected
            self._ensure_connected()

            # Capture preview image and convert from c-bytearray to python bytes
            camera_file = gp.CameraFile()
            self._camera.capture_preview(camera_file)
            image_data = camera_file.get_data_and_size().tobytes()
            logger.info("Preview captured successfully.")
            return image_data
        except CameraError as e:
            raise CameraPreviewError("Failed to capture preview", original_error=e)

    @synchronized(_lock)
    @wrap_gphoto2_error("camera.capture")
    def capture(self, save_to_path: str, image_name: Optional[str] = None) -> dict[str, str]:
        logger.debug(f"capture({save_to_path}, {image_name})")
        logger.info("Capturing full-resolution image...")

        try:
            # Fail-fast if camera is not connected
            self._ensure_connected()

            # Generate absolute path and file name
            absolute_path = Path(save_to_path)  # Convert to absolute path
            absolute_path.mkdir(parents=True, exist_ok=True)
            image_name = image_name or f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            # Capture image using gphoto2
            image_path = self._camera.capture(gp.GP_CAPTURE_IMAGE)
            ext = image_path.name.split(".")[-1]  # Get file extension as provided by camera

            # Transfer image from camera
            camera_file = gp.CameraFile()
            self._camera.file_get(image_path.folder, image_path.name, gp.GP_FILE_TYPE_NORMAL, camera_file)
            full_path = absolute_path / f"{image_name}.{ext}"
            camera_file.save(str(full_path))

            logger.info(f"Image saved to {full_path}")
            return {
                "path": str(full_path),  # Return absolute path
                "filename": full_path.name,
                "timestamp": datetime.now().isoformat(),
            }
        except CameraError as e:
            raise CameraCaptureError("Failed to capture image", e)

    @synchronized(_lock)
    @wrap_gphoto2_error("camera.get_config")
    def get_config(self, configs: Optional[List[str]] = None) -> dict[str, CameraServiceConfig]:
        logger.debug(f"get_config({configs})")

        try:
            self._ensure_connected()

            configs = configs or []  # Handle default
            result = {}
            root_config = self._camera.get_config()

            for name in configs:
                try:
                    config_widget = root_config.get_child_by_name(name)
                    if config_widget is not None:
                        config = CameraServiceConfig(config_widget)
                        result[name] = config
                    else:
                        result[name] = None
                        logger.warning(f"Config '{name}' not found")
                except gp.GPhoto2Error as e:
                    if e.code == gp.GP_ERROR_BAD_PARAMETERS:
                        result[name] = None
                        logger.warning(f"Config '{name}' not found")
                        continue
                    raise e

            return result
        except CameraError as e:
            raise CameraError(f"Failed to get configs {configs}", e)

    @synchronized(_lock)
    @wrap_gphoto2_error("camera.get_all_configs")
    def get_all_configs(self) -> dict[str, CameraServiceConfig]:
        logger.debug("get_all_configs()")

        try:
            self._ensure_connected()

            results = {}

            # Get the root configuration from the camera
            root_config = self._camera.get_config()

            # Recursively traverse all configuration sections and options
            def _extract_configs(config):
                config_name = config.get_name()
                results[config_name] = CameraServiceConfig(config)
                logger.debug(results[config_name])

                # Recursively process child configurations
                for i in range(config.count_children()):
                    child_config = config.get_child(i)
                    _extract_configs(child_config)

            # Start the recursive extraction from root
            _extract_configs(root_config)

            logger.debug(f"Retrieved {len(results)} camera configurations")
            return results

        except CameraError as e:
            raise CameraError("Failed to get configs", e)

    @synchronized(_lock)
    def get_values(self, configs: List[str]) -> dict[str, str]:
        logger.debug(f"get_values({configs})")
        try:
            # Fail-fast if camera is not connected
            self._ensure_connected()

            result = {}
            root_config = self._camera.get_config()
            for name in configs:
                config_widget = root_config.get_child_by_name(name)
                result[name] = config_widget.get_value()

            return result
        except CameraError as e:
            raise CameraError(f"Failed to get values {configs}", e)

    @synchronized(_lock)
    @wrap_gphoto2_error("camera.set_config")
    def set_config(self, configs: list[tuple[str, Any]]) -> bool:
        logger.debug(f"set_config({configs})")
        try:
            # Fail-fast if camera is not connected
            self._ensure_connected()

            root_config = self._camera.get_config()
            for name, value in configs:
                config_widget = root_config.get_child_by_name(name)
                config_widget.set_value(value)
            self._camera.set_config(root_config)

            logger.info("Camera configuration updated")
            return True
        except CameraError as e:
            raise CameraError(f"Failed to set configs {configs}", e)

    @staticmethod
    def connected_cameras() -> Optional[list[dict]]:
        logger.debug("connected_cameras()")
        try:
            result = subprocess.run(
                ["gphoto2", "--auto-detect"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )
            lines = result.stdout.strip().split("\n")
            if len(lines) <= 2:
                return None
            return [
                {"model": parts[0].strip(), "port": parts[1].strip()}
                for line in lines[2:]
                if (parts := line.rsplit(None, 1)) and len(parts) == 2
            ] or None
        except subprocess.CalledProcessError as e:
            logger.error(f"Error running gphoto2: {e.stderr}")
            raise e
        except Exception as e:
            logger.error(f"Unexpected error while detecting cameras: {e}")
            raise e

    @staticmethod
    def reset_camera_usb() -> bool:
        logger.debug("reset_camera_usb()")
        try:
            if not CameraService._has_usbreset():
                logger.info("usbreset utility not available.")
                return False
            cameras = CameraService.connected_cameras()
            if not cameras:
                logger.info("No cameras found to reset.")
                return False
            for camera in cameras:
                port = camera.get("port")
                if not port:
                    continue
                subprocess.run(["usbreset", port.split(":")[1].replace(",", "/")], check=True)
                logger.info(f"USB reset completed for: {camera['model']}")
                time.sleep(1)
            return True
        except Exception as e:
            logger.error(f"USB reset failed: {e}")
            raise e

    @staticmethod
    def _has_usbreset() -> bool:
        logger.debug("_has_usbreset()")
        try:
            result = subprocess.run(
                ["which", "usbreset"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )
            return bool(result.stdout.strip())
        except Exception as e:
            logger.error(f"usbreset availability check failed: {e}")
            raise
