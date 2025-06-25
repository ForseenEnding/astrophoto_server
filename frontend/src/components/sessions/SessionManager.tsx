import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSessions } from '../../hooks/useSessions'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { SessionList } from './SessionList'

interface SessionManagerProps {
  compact?: boolean
}

export function SessionManager({ compact = false }: SessionManagerProps) {
  const { 
    sessions, 
    activeSessionId, 
    activateSession,
    deleteSession,
    updateSession,
    isActivating,
    isDeleting,
    isUpdating
  } = useSessions()

  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleActivateSession = (sessionId: string) => {
    activateSession(sessionId)
  }

  const handlePauseSession = async (sessionId: string) => {
    try {
      await updateSession({ sessionId, updates: { status: 'paused' } })
    } catch (error) {
      console.error('Failed to pause session:', error)
    }
  }

  const handleResumeSession = async (sessionId: string) => {
    try {
      await updateSession({ sessionId, updates: { status: 'active' } })
    } catch (error) {
      console.error('Failed to resume session:', error)
    }
  }

  const handleCancelSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error('Failed to cancel session:', error)
    }
  }

  // Transform sessions to match SessionList interface
  const transformedSessions = sessions.map(session => ({
    id: session.id,
    name: session.name,
    target: session.target,
    status: session.status,
    created_at: session.created_at,
    image_count: session.statistics?.successful_captures || 0,
    target_count: session.capture_plan?.target_count || 0
  }))

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Sessions</h3>
          <Button
            onClick={() => setShowCreateForm(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Session
          </Button>
        </div>
        <SessionList
          sessions={transformedSessions}
          activeSessionId={activeSessionId}
          onActivateSession={handleActivateSession}
          onPauseSession={handlePauseSession}
          onResumeSession={handleResumeSession}
          onCancelSession={handleCancelSession}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Session Management
        </h2>
        <Button
          onClick={() => setShowCreateForm(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Session
        </Button>
      </div>

      <SessionList
        sessions={transformedSessions}
        activeSessionId={activeSessionId}
        onActivateSession={handleActivateSession}
        onPauseSession={handlePauseSession}
        onResumeSession={handleResumeSession}
        onCancelSession={handleCancelSession}
      />

      {showCreateForm && (
        <Card title="Create New Session" className="mt-6">
          <div className="text-center text-gray-500 py-8">
            Session creation wizard will be implemented here.
            <br />
            <Button
              onClick={() => setShowCreateForm(false)}
              variant="secondary"
              className="mt-4"
            >
              Close
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
} 