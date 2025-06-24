import { useSessions } from '@/hooks/useSessions'
import { FolderOpen, Plus, Star } from 'lucide-react'
import React, { useState } from 'react'

interface SessionManagerProps {
  compact?: boolean
}

export function SessionManager({ compact = false }: SessionManagerProps) {
  const { sessions, activeSessionId, createSession, activateSession, isCreating } = useSessions()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSession, setNewSession] = useState({ name: '', target: '' })

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault()
    if (newSession.name && newSession.target) {
      createSession(newSession)
      setNewSession({ name: '', target: '' })
      setShowCreateForm(false)
    }
  }

  if (compact) {
    return (
      <div className="session-manager-compact">
        <h3>
          <FolderOpen className="inline w-5 h-5 mr-2" />
          Sessions
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {sessions.length} total
            {activeSessionId && (
              <span className="ml-2">
                <Star className="inline w-3 h-3 text-yellow-500" />
                Active
              </span>
            )}
          </span>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
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
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Session
        </button>
      </div>

      {showCreateForm && (
        <div className="create-session-form">
          <h3>Create New Session</h3>
          <form onSubmit={handleCreateSession}>
            <div className="form-group">
              <label htmlFor="session-name">Session Name:</label>
              <input
                id="session-name"
                type="text"
                value={newSession.name}
                onChange={(e) => setNewSession(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., M31 Andromeda Galaxy"
                className="input"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="session-target">Target Object:</label>
              <input
                id="session-target"
                type="text"
                value={newSession.target}
                onChange={(e) => setNewSession(prev => ({ ...prev, target: e.target.value }))}
                placeholder="e.g., M31"
                className="input"
                required
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" disabled={isCreating} className="btn btn-primary">
                {isCreating ? 'Creating...' : 'Create Session'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="sessions-list">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <FolderOpen className="w-12 h-12 text-gray-400" />
            <p>No sessions yet. Create your first session to get started!</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-card ${activeSessionId === session.id ? 'active' : ''}`}
            >
              <div className="session-info">
                <h4>{session.name}</h4>
                <p className="session-target">Target: {session.target}</p>
                <p className="session-stats">
                  {session.statistics.successful_captures} captures
                </p>
                <p className="session-date">
                  Created: {new Date(session.created_at).toLocaleDateString()}
                </p>
              </div>
              
              <div className="session-actions">
                {activeSessionId === session.id ? (
                  <span className="active-badge">
                    <Star className="w-4 h-4" />
                    Active
                  </span>
                ) : (
                  <button
                    onClick={() => activateSession(session.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}