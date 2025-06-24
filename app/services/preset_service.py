import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class PresetServiceError(Exception):
    """Base exception for preset-related errors"""

    pass


class PresetNotFoundError(PresetServiceError):
    """Raised when a preset cannot be found"""

    pass


class PresetService:
    def __init__(self, presets_root: str = "projects/.config/presets"):
        self.presets_dir = Path(presets_root)
        self.presets_dir.mkdir(parents=True, exist_ok=True)

    def save_preset(self, name: str, label: str, configs: Dict[str, str], description: Optional[str] = None) -> dict:
        """Save camera configurations as a preset"""
        try:
            if not configs:
                raise PresetServiceError("Cannot save preset with no configurations")

            # Create preset data
            preset_data = {
                "name": name,
                "label": label,
                "description": description,
                "created_at": datetime.now().isoformat(),
                "configs": configs,
            }

            # Save to file
            preset_file = self.presets_dir / f"{name}.json"
            with open(preset_file, "w") as f:
                json.dump(preset_data, f, indent=2)

            logger.info(f"Saved preset '{name}' with {len(configs)} configurations")
            return preset_data

        except Exception as e:
            logger.error(f"Failed to save preset '{name}': {e}")
            raise PresetServiceError(f"Failed to save preset: {str(e)}")

    def list_presets(self) -> List[dict]:
        """List all available presets"""
        try:
            presets = []

            for preset_file in self.presets_dir.glob("*.json"):
                try:
                    with open(preset_file, "r") as f:
                        preset_data = json.load(f)
                    presets.append(preset_data)
                except Exception as e:
                    logger.warning(f"Failed to load preset {preset_file.name}: {e}")

            # Sort by creation date, newest first
            presets.sort(key=lambda p: p.get("created_at", ""), reverse=True)
            return presets

        except Exception as e:
            logger.error(f"Failed to list presets: {e}")
            raise PresetServiceError(f"Failed to list presets: {str(e)}")

    def get_preset(self, name: str) -> dict:
        """Get a specific preset by name"""
        try:
            preset_file = self.presets_dir / f"{name}.json"

            if not preset_file.exists():
                raise PresetNotFoundError(f"Preset '{name}' not found")

            with open(preset_file, "r") as f:
                return json.load(f)

        except PresetNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to get preset '{name}': {e}")
            raise PresetServiceError(f"Failed to get preset: {str(e)}")

    def delete_preset(self, name: str) -> bool:
        """Delete a preset"""
        try:
            preset_file = self.presets_dir / f"{name}.json"

            if not preset_file.exists():
                raise PresetNotFoundError(f"Preset '{name}' not found")

            preset_file.unlink()
            logger.info(f"Deleted preset '{name}'")
            return True

        except PresetNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete preset '{name}': {e}")
            raise PresetServiceError(f"Failed to delete preset: {str(e)}")

    def preset_exists(self, name: str) -> bool:
        """Check if a preset exists"""
        preset_file = self.presets_dir / f"{name}.json"
        return preset_file.exists()
