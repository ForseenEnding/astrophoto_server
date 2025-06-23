import logging
from enum import IntEnum
from gphoto2 import gphoto2 as gp

logger = logging.getLogger(__name__)


class CameraConfigManager:
    """
    Manages the configuration tree of a gphoto2 camera using a flattened
    list of widget entries for easier access and manipulation.
    """

    class Entry:
        """
        Represents a single configuration widget in the camera's configuration tree.
        """

        id: int
        name: str
        type: "CameraConfigManager.Entry.Type"
        parent_id: int
        root_id: int
        label: str
        children_ids: list[int]
        read_only: bool
        value: any
        choices: list[str]

        class Type(IntEnum):
            GP_WIDGET_WINDOW = 0
            GP_WIDGET_SECTION = 1
            GP_WIDGET_TEXT = 2
            GP_WIDGET_RANGE = 3
            GP_WIDGET_TOGGLE = 4
            GP_WIDGET_RADIO = 5
            GP_WIDGET_MENU = 6
            GP_WIDGET_BUTTON = 7
            GP_WIDGET_DATE = 8

        def __init__(self, manager, widget: gp.CameraWidget):
            self.widget = widget
            self.manager = manager

            self.id = widget.get_id()
            self.name = widget.get_name()
            self.type = self.Type(widget.get_type())
            parent = self._default_on_except(widget.get_parent, None)
            self.parent_id = parent.get_id() if parent else -1
            root = self._default_on_except(widget.get_root, None)
            self.root_id = root.get_id() if root else -1
            self.label = self._default_on_except(widget.get_label, None)
            self.children_ids = [
                child.get_id()
                for child in self._default_on_except(widget.get_children, [])
            ]
            self.refresh()

            logger.debug(
                f"Created Entry: id={self.id}, name={self.name}, type={self.type}, "
                f"parent_id={self.parent_id}, children={self.children_ids}"
            )

        def _default_on_except(self, delegate, default):
            try:
                return delegate()
            except gp.GPhoto2Error as e:
                logger.debug(f"Exception caught in default fallback: {e}")
                return default

        def _get_choices(self, widget):
            # Only MENU and RADIO widgets have choices
            if self.type in [self.Type.GP_WIDGET_MENU, self.Type.GP_WIDGET_RADIO]:
                try:
                    count = widget.count_choices()
                    return [widget.get_choice(i) for i in range(count)]
                except gp.GPhoto2Error as e:
                    logger.warning(f"Failed to get choices for widget {self.name}: {e}")
                    return []
            return []

        def set_value(self, value):
            """
            Sets the value of the widget. Validates against choices if applicable,
            and writes the updated config back to the camera.
            """
            if self.choices and value not in self.choices:
                raise ValueError(
                    f"Invalid value '{value}' for widget '{self.name}'. Choices: {self.choices}"
                )

            try:
                self.widget.set_value(value)
                logger.info(f"Set value '{value}' for '{self.name}'")
                self.refresh()
            except gp.GPhoto2Error as e:
                logger.error(f"Failed to set value '{value}' for '{self.name}': {e}")
                raise

            if value != self.value:
                logger.warning(
                    f"Value for '{self.name}' failed to change from '{self.value}' to '{value}'"
                )

        def refresh(self):
            self.read_only = self._default_on_except(self.widget.get_readonly, False)
            self.value = self._default_on_except(self.widget.get_value, None)
            self.choices = self._get_choices(self.widget)

        def get_children(self):
            return [self.manager.get(cid) for cid in self.children_ids]

        def get_parent(self):
            return self.manager.get(self.parent_id)

        def get_root(self):
            return self.manager.get(self.root_id)

        def __repr__(self):
            return f"<Entry name={self.name} type={self.type.name} id={self.id}>"

    def __init__(self, camera: gp.Camera):
        """
        Initializes the configuration manager with a gphoto2 Camera object.
        """
        self.camera = camera
        try:
            self.config = camera.get_config()
            logger.info("Camera configuration successfully loaded.")
        except gp.GPhoto2Error as e:
            logger.error("Failed to load camera config: %s", e)
            raise

        self.entries = []
        try:
            flat_entries = self._widget_to_list(self.config)
            max_id = max(e.id for e in flat_entries)
            self.entries = [None] * (max_id + 1)
            for e in flat_entries:
                self.entries[e.id] = e
            logger.info("Configuration entries parsed successfully.")
        except gp.GPhoto2Error as e:
            logger.error("Failed to parse config entries: %s", e)
            raise

    def _widget_to_list(self, widget: gp.CameraWidget):
        """
        Recursively flattens the widget tree into a list of Entry instances.
        """
        config_list = [self.Entry(self, widget)]
        for child in self._safe_get_children(widget):
            config_list.extend(self._widget_to_list(child))
        return config_list

    def _safe_get_children(self, widget):
        try:
            return widget.get_children()
        except gp.GPhoto2Error as e:
            logger.warning(
                f"Failed to get children for widget {widget.get_name()}: {e}"
            )
            return []

    def filter_by(self, predicate):
        """
        Returns a list of entries matching the given predicate function.
        """
        return list(filter(predicate, self.entries if self.entries else []))

    def get_all(self):
        """
        Returns all entries in the configuration.
        """
        return list(self.entries)

    def get_by(self, predicate, default=None):
        """
        Returns the first entry matching the predicate or the default value.
        """
        return next((e for e in self.entries if e and predicate(e)), default)

    def get(self, id: int):
        """
        Retrieves an entry by its ID.
        """
        try:
            return self.entries[id]
        except IndexError:
            logger.error(f"Entry ID {id} out of range.")
            raise

    def get_by_name(self, name: str):
        """
        Returns an entry by its widget name.
        """
        return self.get_by(lambda e: e.name == name)

    def filter_by_parent(self, parent: Entry):
        """
        Filters entries that have the specified parent entry.
        """
        if parent is None:
            raise TypeError("Parent should never be 'None'")
        return self.filter_by(lambda e: e.parent_id == parent.id)

    def refresh(self):
        """Refresh all entries from camera"""
        for e in self.entries:
            if e:
                e.refresh()

    def apply_changes(self):
        """Apply all configuration changes to the camera"""
        try:
            self.camera.set_config(self.config)
            logger.info("Configuration changes applied to camera")
        except gp.GPhoto2Error as e:
            logger.error(f"Failed to apply configuration changes: {e}")
            raise
