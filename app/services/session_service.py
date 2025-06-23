import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from app.models.session_models import (
    Session,
    SessionStatus,
    SessionImage,
    CapturePlan,
)


logger = logging.getLogger(__name__)


class SessionError(Exception):
    """Base exception for session-related errors"""

    pass


class SessionNotFoundError(SessionError):
    """Raised when a session cannot be found"""

    pass


class SessionService:
    def __init__(self, projects_root: str = "projects"):
        self.projects_root = Path(projects_root)
        self.projects_root.mkdir(exist_ok=True)
        self._active_session_id: Optional[str] = None

        # Try to restore active session from state file
        self._load_active_session_state()

    def _load_active_session_state(self):
        """Load the active session from persistent state"""
        state_file = self.projects_root / ".active_session"
        if state_file.exists():
            try:
                self._active_session_id = state_file.read_text().strip()
                # Verify the session still exists
                if not self._session_exists(self._active_session_id):
                    logger.warning(f"Active session {self._active_session_id} no longer exists, clearing")
                    self._active_session_id = None
                    state_file.unlink()
            except Exception as e:
                logger.warning(f"Failed to load active session state: {e}")
                self._active_session_id = None

    def _save_active_session_state(self):
        """Save the active session to persistent state"""
        state_file = self.projects_root / ".active_session"
        if self._active_session_id:
            state_file.write_text(self._active_session_id)
        elif state_file.exists():
            state_file.unlink()

    def _generate_session_id(self, target: str) -> str:
        """Generate a unique session ID based on target and date"""
        date_str = datetime.now().strftime("%Y%m%d")
        base_id = f"{target.lower()}_{date_str}"

        # Find next available sequence number
        sequence = 1
        while self._session_exists(f"{base_id}_{sequence:03d}"):
            sequence += 1

        return f"{base_id}_{sequence:03d}"

    def _session_exists(self, session_id: str) -> bool:
        """Check if a session directory exists"""
        return (self.projects_root / session_id).exists()

    def _get_session_path(self, session_id: str) -> Path:
        """Get the full path to a session directory"""
        return self.projects_root / session_id

    def _get_session_file(self, session_id: str) -> Path:
        """Get the path to the session.json file"""
        return self._get_session_path(session_id) / "session.json"

    def _create_session_directories(self, session_id: str):
        """Create the session directory structure"""
        session_path = self._get_session_path(session_id)
        session_path.mkdir(exist_ok=True)
        (session_path / "captures").mkdir(exist_ok=True)
        (session_path / "previews").mkdir(exist_ok=True)
        (session_path / "analysis").mkdir(exist_ok=True)

    def _save_session(self, session: Session):
        """Save session metadata to disk"""
        session_file = self._get_session_file(session.id)
        session.update_timestamp()

        with open(session_file, "w") as f:
            json.dump(session.model_dump(mode="json"), f, indent=2, default=str)

        logger.debug(f"Session {session.id} saved to {session_file}")

    def _load_session(self, session_id: str) -> Session:
        """Load session metadata from disk"""
        session_file = self._get_session_file(session_id)

        if not session_file.exists():
            raise SessionNotFoundError(f"Session {session_id} not found")

        try:
            with open(session_file, "r") as f:
                data = json.load(f)
            return Session(**data)
        except Exception as e:
            raise SessionError(f"Failed to load session {session_id}: {e}")

    def create_session(self, name: str, target: str, capture_plan: Optional[CapturePlan] = None) -> Session:
        """Create a new session"""
        session_id = self._generate_session_id(target)
        now = datetime.now()

        session = Session(
            id=session_id,
            name=name,
            target=target,
            created_at=now,
            updated_at=now,
            capture_plan=capture_plan or CapturePlan(),
        )

        # Create directory structure
        self._create_session_directories(session_id)

        # Save session metadata
        self._save_session(session)

        logger.info(f"Created new session: {session_id}")
        return session

    def get_session(self, session_id: str) -> Session:
        """Get a session by ID"""
        return self._load_session(session_id)

    def list_sessions(self) -> list[Session]:
        """List all sessions, sorted by creation date (newest first)"""
        sessions = []

        for session_dir in self.projects_root.iterdir():
            if session_dir.is_dir() and not session_dir.name.startswith("."):
                try:
                    session = self._load_session(session_dir.name)
                    sessions.append(session)
                except Exception as e:
                    logger.warning(f"Failed to load session {session_dir.name}: {e}")

        # Sort by creation date, newest first
        sessions.sort(key=lambda s: s.created_at, reverse=True)
        return sessions

    def update_session(
        self,
        session_id: str,
        name: Optional[str] = None,
        status: Optional[SessionStatus] = None,
        capture_plan: Optional[CapturePlan] = None,
    ) -> Session:
        """Update session metadata"""
        session = self._load_session(session_id)

        if name is not None:
            session.name = name
        if status is not None:
            session.status = status
        if capture_plan is not None:
            session.capture_plan = capture_plan

        self._save_session(session)
        logger.info(f"Updated session {session_id}")
        return session

    def delete_session(self, session_id: str) -> bool:
        """Delete a session and all its data"""
        if not self._session_exists(session_id):
            raise SessionNotFoundError(f"Session {session_id} not found")

        # Clear active session if deleting it
        if self._active_session_id == session_id:
            self.set_active_session(None)

        # Remove directory and all contents
        import shutil

        session_path = self._get_session_path(session_id)
        shutil.rmtree(session_path)

        logger.info(f"Deleted session {session_id}")
        return True

    def set_active_session(self, session_id: Optional[str]):
        """Set the active session for captures"""
        if session_id and not self._session_exists(session_id):
            raise SessionNotFoundError(f"Session {session_id} not found")

        self._active_session_id = session_id
        self._save_active_session_state()
        logger.info(f"Active session set to: {session_id}")

    def get_active_session_id(self) -> Optional[str]:
        """Get the current active session ID"""
        return self._active_session_id

    def get_active_session(self) -> Optional[Session]:
        """Get the current active session"""
        if not self._active_session_id:
            return None
        try:
            return self._load_session(self._active_session_id)
        except SessionNotFoundError:
            # Clear invalid active session
            self.set_active_session(None)
            return None

    def add_image_to_session(
        self, session_id: str, filename: str, size_bytes: Optional[int] = None, focus_score: Optional[float] = None
    ) -> Session:
        """Add an image to a session and update statistics"""
        session = self._load_session(session_id)

        # Create image entry
        image = SessionImage(
            filename=filename,
            captured_at=datetime.now(),
            size_bytes=size_bytes,
            focus_score=focus_score,
            preview_path=f"previews/{Path(filename).stem}_thumb.jpg",
        )

        session.images.append(image)

        # Update statistics
        session.statistics.total_captures += 1
        session.statistics.successful_captures += 1

        # Update average focus score if available
        focus_scores = [img.focus_score for img in session.images if img.focus_score is not None]
        if focus_scores:
            session.statistics.average_focus_score = sum(focus_scores) / len(focus_scores)

        self._save_session(session)
        logger.info(f"Added image {filename} to session {session_id}")
        return session

    def get_session_captures_path(self, session_id: str) -> Path:
        """Get the captures directory path for a session"""
        return self._get_session_path(session_id) / "captures"

    def get_session_previews_path(self, session_id: str) -> Path:
        """Get the previews directory path for a session"""
        return self._get_session_path(session_id) / "previews"
