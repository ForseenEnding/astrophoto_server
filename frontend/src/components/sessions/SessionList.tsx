import { CheckCircle, Clock, Pause, Play, XCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

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
  onPauseSession: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
  onCancelSession: (sessionId: string) => void
}

export function SessionList({
  sessions,
  activeSessionId,
  onActivateSession,
  onPauseSession,
  onResumeSession,
  onCancelSession
}: SessionListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4 text-green-500" />
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />
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
      <Card title="Sessions">
        <div className="text-center text-gray-500 py-8">
          No sessions found. Create a new session to get started.
        </div>
      </Card>
    )
  }

  return (
    <Card title="Sessions">
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`p-4 border rounded-lg transition-colors ${
              session.id === activeSessionId
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  {getStatusIcon(session.status)}
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {session.name}
                  </h4>
                  <span className="text-sm text-gray-500">
                    {getStatusText(session.status)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Target: {session.target} • {session.image_count}/{session.target_count} images
                </div>
                <div className="text-xs text-gray-500">
                  Created: {new Date(session.created_at).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {session.status === 'active' && (
                  <>
                    <Button
                      onClick={() => onPauseSession(session.id)}
                      variant="secondary"
                      size="sm"
                    >
                      Pause
                    </Button>
                    <Button
                      onClick={() => onCancelSession(session.id)}
                      variant="danger"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {session.status === 'paused' && (
                  <>
                    <Button
                      onClick={() => onResumeSession(session.id)}
                      variant="success"
                      size="sm"
                    >
                      Resume
                    </Button>
                    <Button
                      onClick={() => onCancelSession(session.id)}
                      variant="danger"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {session.status === 'completed' && (
                  <Button
                    onClick={() => onActivateSession(session.id)}
                    variant="primary"
                    size="sm"
                  >
                    View
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
} 