import inspect
import sys
from typing import Any


def dump(
    obj: Any,
    name: str = None,
    depth: int = 2,
    show_private: bool = False,
    show_methods: bool = True,
    show_docs: bool = False,
    max_str_len: int = 200,
):
    """
    Comprehensive object dump function for debugging and exploration.

    Args:
        obj: The object to dump
        name: Optional name to display for the object
        depth: How deep to recurse into nested objects (default: 2)
        show_private: Whether to show private attributes (starting with _)
        show_methods: WHETHER to show methods and functions
        show_docs: Whether to show docstrings
        max_str_len: Maximum length for string representations
    """

    def _truncate_str(s: str, max_len: int = max_str_len) -> str:
        """Truncate long strings for readability."""
        if len(s) > max_len:
            return s[: max_len - 3] + "..."
        return s

    def _get_size(obj) -> str:
        """Get memory size of object if possible."""
        try:
            return f"{sys.getsizeof(obj)} bytes"
        except Exception:
            return "unknown size"

    def _dump_recursive(obj, current_depth: int = 0, prefix: str = ""):
        if current_depth > depth:
            return f"{prefix}... (max depth reached)"

        obj_type = type(obj).__name__
        obj_id = id(obj)

        # Basic info header
        header = f"{prefix}━━━ Object Dump ━━━"
        if name and current_depth == 0:
            header += f" [{name}]"

        lines = [
            header,
            f"{prefix}Type: {obj_type}",
            f"{prefix}ID: {obj_id}",
            f"{prefix}Size: {_get_size(obj)}",
        ]

        # Add module info if available
        if hasattr(obj, "__module__"):
            lines.append(f"{prefix}Module: {obj.__module__}")

        # String representation
        try:
            str_repr = _truncate_str(str(obj))
            lines.append(f"{prefix}String repr: {str_repr}")
        except Exception:
            lines.append(f"{prefix}String repr: <cannot convert to string>")

        # For simple types, show value directly
        if obj_type in ["int", "float", "str", "bool", "NoneType"]:
            if obj_type == "str" and len(obj) > max_str_len:
                lines.append(f"{prefix}Value: {_truncate_str(repr(obj))}")
            else:
                lines.append(f"{prefix}Value: {repr(obj)}")

        # For collections, show length and sample items
        elif hasattr(obj, "__len__"):
            try:
                length = len(obj)
                lines.append(f"{prefix}Length: {length}")

                if obj_type in ["list", "tuple"] and length > 0:
                    lines.append(f"{prefix}Sample items:")
                    for i, item in enumerate(obj[:3]):  # Show first 3 items
                        lines.append(f"{prefix}  [{i}]: {_truncate_str(repr(item))}")
                    if length > 3:
                        lines.append(f"{prefix}  ... and {length - 3} more items")

                elif obj_type == "dict" and length > 0:
                    lines.append(f"{prefix}Sample key-value pairs:")
                    for i, (k, v) in enumerate(list(obj.items())[:3]):
                        lines.append(f"{prefix}  {repr(k)}: {_truncate_str(repr(v))}")
                    if length > 3:
                        lines.append(f"{prefix}  ... and {length - 3} more pairs")

            except Exception:
                lines.append(f"{prefix}Length: <cannot determine>")

        # Get all attributes
        try:
            all_attrs = dir(obj)
            if not show_private:
                all_attrs = [attr for attr in all_attrs if not attr.startswith("_")]

            # Separate attributes by type
            properties = []
            methods = []
            other_attrs = []

            for attr_name in all_attrs:
                try:
                    attr_value = getattr(obj, attr_name)
                    if callable(attr_value):
                        methods.append((attr_name, attr_value))
                    elif isinstance(attr_value, property):
                        properties.append((attr_name, attr_value))
                    else:
                        other_attrs.append((attr_name, attr_value))
                except Exception:
                    other_attrs.append((attr_name, "<cannot access>"))

            # Show properties/attributes
            if other_attrs:
                lines.append(f"{prefix}Attributes ({len(other_attrs)}):")
                for attr_name, attr_value in other_attrs[:10]:  # Limit to first 10
                    try:
                        value_repr = _truncate_str(repr(attr_value))
                        value_type = type(attr_value).__name__
                        lines.append(
                            f"{prefix}  {attr_name}: {value_repr} ({value_type})"
                        )
                    except Exception:
                        lines.append(f"{prefix}  {attr_name}: <cannot represent>")
                if len(other_attrs) > 10:
                    lines.append(
                        f"{prefix}  ... and {len(other_attrs) - 10} more attributes"
                    )

            # Show methods
            if show_methods and methods:
                lines.append(f"{prefix}Methods ({len(methods)}):")
                for method_name, method_obj in methods[:10]:  # Limit to first 10
                    try:
                        sig = inspect.signature(method_obj)
                        lines.append(f"{prefix}  {method_name}{sig}")
                        if show_docs and method_obj.__doc__:
                            doc = _truncate_str(method_obj.__doc__.strip())
                            lines.append(f"{prefix}    → {doc}")
                    except Exception:
                        lines.append(f"{prefix}  {method_name}(...)")
                if len(methods) > 10:
                    lines.append(f"{prefix}  ... and {len(methods) - 10} more methods")

        except Exception as e:
            lines.append(f"{prefix}Error getting attributes: {e}")

        # Show class hierarchy
        try:
            mro = obj.__class__.__mro__
            if len(mro) > 1:
                lines.append(
                    f"{prefix}Class hierarchy: {' → '.join([cls.__name__ for cls in mro])}"
                )
        except Exception:
            pass

        return "\n".join(lines)

    print(_dump_recursive(obj))


# Convenience functions for common use cases
def quick_dump(obj, name: str = None):
    """Quick dump with minimal output."""
    dump(obj, name, depth=1, show_methods=False, show_docs=False)


def deep_dump(obj, name: str = None):
    """Deep dump with maximum detail."""
    dump(obj, name, depth=3, show_private=True, show_methods=True, show_docs=True)


def method_dump(obj, name: str = None):
    """Focus on methods and their signatures."""
    dump(obj, name, depth=1, show_methods=True, show_docs=True)
