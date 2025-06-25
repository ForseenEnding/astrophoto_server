import { useSessions } from '@/hooks/useSessions'
import {
  Activity,
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle,
  Circle,
  FolderOpen,
  Pause,
  Play,
  Plus,
  Settings,
  Star,
  Target,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import { SessionWizard } from './SessionWizard'

interface SessionManagerProps {
  compact?: boolean
  onStartSession?: (sessionId: string) => void
}

export function SessionManager({ compact = false, onStartSession }: SessionManagerProps) {
  const { 
    sessions, 
    activeSessionId,
//    createSession, 
    activateSession, 
    deleteSession,
    isCreating,
    isDeleting 
  } = useSessions()
  
  const [showWizard, setShowWizard] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDeleteSession = (sessionId: string) => {
    setSessionToDelete(sessionId)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete)
      setSessionToDelete(null)
      setShowDeleteConfirm(false)
    }
  }

  const handleStartSession = (sessionId: string) => {
    activateSession(sessionId)
    if (onStartSession) {
      onStartSession(sessionId)
    }
  }

  const getSessionStatusIcon = (session: any) => {
    switch (session.status) {
      case 'active':
        return <Activity className="w-4 h-4 text-green-400" />
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-400" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-400" />
      default:
        return <Circle className="w-4 h-4 text-gray-400" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (compact) {
    return (
      <div className="session-manager-compact">
        <h3>
          <FolderOpen className="inline w-5 h-5 mr-2" />
          Sessions
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {sessions.length} total
            {activeSessionId && (
              <span className="ml-2">
                <Star className="inline w-3 h-3 text-yellow-400" />
                Active
              </span>
            )}
          </span>
          <button
            onClick={() => setShowWizard(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>

        {showWizard && (
          <SessionWizard
            onClose={() => setShowWizard(false)}
            onSessionCreated={(sessionId) => {
              setShowWizard(false)
              handleStartSession(sessionId)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="session-manager">
      <div className="session-header">
        <h2>
          <FolderOpen className="inline w-6 h-6 mr-2" />
          Session Management
        </h2>
        <button
          onClick={() => setShowWizard(true)}
          className="btn btn-primary"
          disabled={isCreating}
        >
          <Plus className="w-4 h-4 mr-2" />
          {isCreating ? 'Creating...' : 'New Session'}
        </button>
      </div>

      <div className="sessions-list">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <FolderOpen className="w-12 h-12 text-gray-400" />
            <h3>No sessions yet</h3>
            <p>Create your first astrophotography session to get started!</p>
            <button
              onClick={() => setShowWizard(true)}
              className="btn btn-primary mt-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Session
            </button>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-card ${activeSessionId === session.id ? 'active' : ''}`}
            >
              <div className="session-card-header">
                <div className="session-main-info">
                  <div className="session-title-row">
                    <h4 className="session-name">{session.name}</h4>
                    {getSessionStatusIcon(session)}
                  </div>
                  <div className="session-details">
                    <div className="session-detail">
                      <Target className="w-4 h-4" />
                      <span>{session.target}</span>
                    </div>
                    <div className="session-detail">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(session.created_at)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="session-actions">
                  {activeSessionId === session.id ? (
                    <span className="active-badge">
                      <Star className="w-4 h-4" />
                      Active
                    </span>
                  ) : (
                    <div className="session-action-buttons">
                      <button
                        onClick={() => handleStartSession(session.id)}
                        className="btn btn-primary btn-sm"
                        title="Start this session"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                      <button
                        onClick={() => activateSession(session.id)}
                        className="btn btn-secondary btn-sm"
                        title="Set as active"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="btn btn-error btn-sm"
                    disabled={isDeleting}
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="session-stats">
                <div className="session-stat">
                  <Camera className="w-4 h-4" />
                  <span>{session.statistics.successful_captures} captures</span>
                </div>
                <div className="session-stat">
                  <Settings className="w-4 h-4" />
                  <span>{session.capture_plan?.exposure_time || 'No plan'}</span>
                </div>
                <div className="session-stat">
                  <Activity className="w-4 h-4" />
                  <span>{session.statistics.total_exposure_time}</span>
                </div>
              </div>

              <div className="session-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{
                      width: `${(session.capture_plan?.target_count ?? 0) > 0 
                        ? (session.statistics.successful_captures / (session.capture_plan?.target_count ?? 1)) * 100 
                        : 0}%`
                    }}
                  />
                </div>
                <span className="progress-text">
                  {session.statistics.successful_captures} / {session.capture_plan?.target_count || 0} frames
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Session Wizard Modal */}
      {showWizard && (
        <SessionWizard
          onClose={() => setShowWizard(false)}
          onSessionCreated={(sessionId) => {
            setShowWizard(false)
            handleStartSession(sessionId)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Delete Session
              </h3>
            </div>
            
            <div className="modal-body">
              <p>
                Are you sure you want to delete this session? This will permanently remove:
              </p>
              <ul className="delete-warning-list">
                <li>All captured images and data</li>
                <li>Session configuration and settings</li>
                <li>Analysis results and metadata</li>
              </ul>
              <p className="text-red-400 font-medium">
                This action cannot be undone!
              </p>
            </div>
            
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn btn-error"
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}