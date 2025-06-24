import { useCameraStatus } from '@/hooks/useCameraStatus'
import { useSessions } from '@/hooks/useSessions'
import { AlertCircle, Camera, Circle, FolderOpen } from 'lucide-react'

// Camera Status Indicator for Navigation Bar
export function NavigationCameraStatus() {
  const { status } = useCameraStatus()

  return (
    <div className="nav-status-indicator">
      <div className="nav-status-item">
        <Camera className="w-4 h-4 mr-2" />
        <span className="nav-status-label">Camera:</span>
        <div className={`nav-status-dot ${status.connected ? 'connected' : 'disconnected'}`}>
          <Circle className={`w-2 h-2 ${status.connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
        </div>
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
            <FolderOpen className="w-4 h-4 mr-2 text-green-500" />
            <span className="nav-status-label">Session:</span>
            <span className="nav-session-name">{activeSession.name}</span>
            <span className="nav-session-target">({activeSession.target})</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
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