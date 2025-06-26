import { useCameraStatus } from '@/hooks/useCameraStatus'
import { useSessions } from '@/hooks/useSessions'
import { AlertCircle, Camera, FolderOpen } from 'lucide-react'

// Camera Status Indicator for Navigation Bar
export function NavigationCameraStatus() {
  const { status } = useCameraStatus()

  return (
    <div className="nav-status-indicator">
      <div className="nav-status-item">
        <Camera size={16} />
        <span className={`nav-status-text ${status.connected ? 'connected' : 'disconnected'}`}>
          {status.connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  )
}

// Active Session Indicator for Navigation Bar
export function NavigationSessionStatus() {
  const { sessions, activeSessionId } = useSessions()
  const activeSession = sessions.find(session => session.id === activeSessionId)

  return (
    <div className="nav-status-indicator">
      <div className="nav-status-item">
        {activeSession ? (
          <>
            <FolderOpen size={16} className="connected" />
            <span className="nav-status-label">Session:</span>
            <span className="nav-session-name">{activeSession.name}</span>
            <span className="nav-session-target">({activeSession.target})</span>
          </>
        ) : (
          <>
            <AlertCircle size={16} className="inactive" />
            <span className="nav-status-label">Session:</span>
            <span className="nav-status-text inactive">None Active</span>
          </>
        )}
      </div>
    </div>
  )
}

// Combined Status Component for Navigation Bar
export function NavigationStatusBar() {
  return (
    <div className="nav-status-bar">
      <NavigationCameraStatus />
      <div className="nav-status-divider" />
      <NavigationSessionStatus />
    </div>
  )
}