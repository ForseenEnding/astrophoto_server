import { CheckCircle, Clock, Play, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'

interface Session {
  id: string
  name: string
  target: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  created_at: string
  image_count: number
  target_count: number
}

interface SessionListProps {
  sessions: Session[]
  activeSessionId?: string
  onActivateSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => Promise<void>
}

export function SessionList({
  sessions,
  activeSessionId,
  onActivateSession,
  onDeleteSession
}: SessionListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4 text-green-500" />
      case 'paused':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case 'cancelled':
        return <Clock className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'paused':
        return 'Paused'
      case 'completed':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Unknown'
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No sessions found. Create a new session to get started.
      </div>
    )
  }

  return (
    <div className="sessions-list">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={`session-card ${
            session.id === activeSessionId ? 'active' : ''
          }`}
        >
          <div className="session-card-header">
            <div className="session-main-info">
              <div className="session-title-row">
                {getStatusIcon(session.status)}
                <h4 className="session-name">{session.name}</h4>
                <span className="session-detail">{getStatusText(session.status)}</span>
              </div>
              <div className="session-details">
                <div className="session-detail">
                  Target: {session.target}
                </div>
                <div className="session-detail">
                  {session.image_count}/{session.target_count} images
                </div>
              </div>
              <div className="session-detail">
                Created: {new Date(session.created_at).toLocaleDateString()}
              </div>
            </div>
            
            <div className="session-actions">
              {session.id !== activeSessionId && (
                <Button
                  onClick={() => onActivateSession(session.id)}
                  variant="primary"
                  size="sm"
                >
                  Activate
                </Button>
              )}
              <Button
                onClick={() => onDeleteSession(session.id)}
                variant="danger"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 