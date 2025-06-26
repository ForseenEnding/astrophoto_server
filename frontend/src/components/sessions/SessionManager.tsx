import { Camera, Cog, Plus, Settings, Zap } from 'lucide-react'
import { useState } from 'react'
import { useSessions } from '../../hooks/useSessions'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { SessionList } from './SessionList'

interface SessionManagerProps {
  compact?: boolean
}

// Common astronomical targets for quick selection
const COMMON_TARGETS = [
  { value: 'm31', label: 'M31 - Andromeda Galaxy' },
  { value: 'm42', label: 'M42 - Orion Nebula' },
  { value: 'm45', label: 'M45 - Pleiades' },
  { value: 'm51', label: 'M51 - Whirlpool Galaxy' },
  { value: 'm101', label: 'M101 - Pinwheel Galaxy' },
  { value: 'm81', label: 'M81 - Bode\'s Galaxy' },
  { value: 'm82', label: 'M82 - Cigar Galaxy' },
  { value: 'm33', label: 'M33 - Triangulum Galaxy' },
  { value: 'm13', label: 'M13 - Hercules Globular Cluster' },
  { value: 'm27', label: 'M27 - Dumbbell Nebula' },
  { value: 'custom', label: 'Custom Target' }
]

interface CalibrationSettings {
  count: number
  interval_seconds: number
  exposure_time?: string
}

interface CaptureSettings {
  count: number
  interval_seconds: number
  exposure_time: string
  iso: number
}

interface CaptureState {
  isRunning: boolean
  progress: number
  current: number
  total: number
  latestImage?: string
}

interface CalibrationState {
  type: 'flat' | 'dark' | 'bias' | null
  isRunning: boolean
  progress: number
  current: number
  total: number
  latestImage?: string
  settings: CalibrationSettings
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
  const [targetObject, setTargetObject] = useState('')
  const [customTarget, setCustomTarget] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  
  // Menu states
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showCalibrationMenu, setShowCalibrationMenu] = useState(false)
  const [showCaptureMenu, setShowCaptureMenu] = useState(false)
  
  // Settings state
  const [captureSettings, setCaptureSettings] = useState<CaptureSettings>({
    count: 10,
    interval_seconds: 5,
    exposure_time: '60s',
    iso: 800
  })
  
  // Capture state
  const [captureState, setCaptureState] = useState<CaptureState>({
    isRunning: false,
    progress: 0,
    current: 0,
    total: 10
  })
  
  // Calibration state
  const [calibrationState, setCalibrationState] = useState<CalibrationState>({
    type: null,
    isRunning: false,
    progress: 0,
    current: 0,
    total: 20,
    settings: {
      count: 20,
      interval_seconds: 2,
      exposure_time: '60s'
    }
  })

  const handleActivateSession = (sessionId: string) => {
    activateSession(sessionId)
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const handleCreateSession = async () => {
    if (!targetObject || (targetObject === 'custom' && !customTarget)) {
      setCreateError('Please select a target object')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const target = targetObject === 'custom' ? customTarget : targetObject
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_')
      const sessionName = `${target}_${dateStr}`
      
      const sessionData = {
        name: sessionName,
        target: target,
        capture_plan: {
          target_count: 100,
          exposure_time: '60s',
          filter: 'none'
        }
      }

      const response = await fetch('/api/sessions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to create session')
      }

      const result = await response.json()
      activateSession(result.session.id)
      setShowCreateForm(false)
      setTargetObject('')
      setCustomTarget('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setIsCreating(false)
    }
  }

  const handleStartCapture = async () => {
    if (!activeSessionId) return

    try {
      const response = await fetch(`/api/sessions/${activeSessionId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image_name: `target_${Date.now()}`,
          count: captureSettings.count,
          interval_seconds: captureSettings.interval_seconds,
          exposure_time: captureSettings.exposure_time,
          iso: captureSettings.iso
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to start capture')
      }

      setCaptureState(prev => ({
        ...prev,
        isRunning: true,
        current: 0,
        total: captureSettings.count
      }))
      
      console.log('Target capture started')
    } catch (err) {
      console.error('Failed to start capture:', err)
    }
  }

  const handleStopCapture = async () => {
    if (!activeSessionId) return

    try {
      const response = await fetch(`/api/sessions/${activeSessionId}/capture/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to stop capture')
      }

      setCaptureState(prev => ({
        ...prev,
        isRunning: false
      }))
      
      console.log('Capture stopped')
    } catch (err) {
      console.error('Failed to stop capture:', err)
    }
  }

  const handleStartCalibration = async (type: 'flat' | 'dark' | 'bias') => {
    if (!activeSessionId) return

    // Set default settings based on type
    const defaultSettings: CalibrationSettings = {
      count: 20,
      interval_seconds: 2,
      exposure_time: type === 'bias' ? undefined : '60s'
    }

    try {
      const calibrationData = {
        session_id: activeSessionId,
        frame_type: type,
        count: defaultSettings.count,
        interval_seconds: defaultSettings.interval_seconds,
        exposure_time: defaultSettings.exposure_time
      }

      const response = await fetch(`/api/sessions/${activeSessionId}/calibration/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calibrationData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to start ${type} calibration`)
      }

      setCalibrationState(prev => ({
        ...prev,
        type,
        isRunning: true,
        current: 0,
        total: defaultSettings.count,
        settings: defaultSettings
      }))
      
      console.log(`${type} calibration started`)
    } catch (err) {
      console.error(`Failed to start ${type} calibration:`, err)
    }
  }

  const handleStopCalibration = async () => {
    if (!activeSessionId || !calibrationState.type) return

    try {
      const response = await fetch(`/api/sessions/${activeSessionId}/calibration/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to stop calibration')
      }

      setCalibrationState(prev => ({
        ...prev,
        isRunning: false
      }))
      
      console.log('Calibration stopped')
    } catch (err) {
      console.error('Failed to stop calibration:', err)
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

  const activeSession = sessions.find(session => session.id === activeSessionId)

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
        {/* Active Session Icons and Session List in same parent */}
        <div>
          {activeSession && (
            <div className="active-session-icons">
              <div className="session-icon-group">
                <button
                  onClick={() => setShowSettingsMenu(true)}
                  className="session-icon-button"
                  title="Settings"
                >
                  <Cog className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowCalibrationMenu(true)}
                  className="session-icon-button"
                  title="Calibration"
                >
                  <Zap className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowCaptureMenu(true)}
                  className="session-icon-button"
                  title="Capture"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <div className="active-session-info">
                <span className="active-session-name">{activeSession.name}</span>
              </div>
            </div>
          )}
          <SessionList
            sessions={transformedSessions}
            activeSessionId={activeSessionId}
            onActivateSession={handleActivateSession}
            onDeleteSession={handleDeleteSession}
          />
        </div>
        {showCreateForm && (
          <Card title="Create New Session" className="mt-4">
            <div className="space-y-4">
              <div className="form-group">
                <label>Target Object</label>
                <Select
                  value={targetObject}
                  onChange={(e) => setTargetObject(e.target.value)}
                >
                  <option value="">Select a target...</option>
                  {COMMON_TARGETS.map(target => (
                    <option key={target.value} value={target.value}>
                      {target.label}
                    </option>
                  ))}
                </Select>
              </div>

              {targetObject === 'custom' && (
                <div className="form-group">
                  <label>Custom Target Name</label>
                  <Input
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    placeholder="Enter target name (e.g., NGC 7000)"
                  />
                </div>
              )}

              {createError && (
                <div className="error-message">
                  {createError}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateSession}
                  loading={isCreating}
                  disabled={!targetObject || (targetObject === 'custom' && !customTarget)}
                >
                  Create Session
                </Button>
                <Button
                  onClick={() => setShowCreateForm(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Settings Menu Modal */}
        {showSettingsMenu && (
          <div className="modal-overlay" onClick={() => setShowSettingsMenu(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Session Settings</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowSettingsMenu(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="settings-section">
                  <h4>Capture Settings</h4>
                  <div className="form-group">
                    <label>Frame Count</label>
                    <Input
                      type="number"
                      value={captureSettings.count}
                      onChange={(e) => setCaptureSettings(prev => ({
                        ...prev,
                        count: parseInt(e.target.value) || 10
                      }))}
                      min="1"
                      max="1000"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Interval (seconds)</label>
                    <Input
                      type="number"
                      value={captureSettings.interval_seconds}
                      onChange={(e) => setCaptureSettings(prev => ({
                        ...prev,
                        interval_seconds: parseInt(e.target.value) || 5
                      }))}
                      min="1"
                      max="300"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Exposure Time</label>
                    <Input
                      value={captureSettings.exposure_time}
                      onChange={(e) => setCaptureSettings(prev => ({
                        ...prev,
                        exposure_time: e.target.value
                      }))}
                      placeholder="e.g., 60s"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>ISO</label>
                    <Input
                      type="number"
                      value={captureSettings.iso}
                      onChange={(e) => setCaptureSettings(prev => ({
                        ...prev,
                        iso: parseInt(e.target.value) || 800
                      }))}
                      min="100"
                      max="6400"
                    />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <Button onClick={() => setShowSettingsMenu(false)}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Capture Menu Modal */}
        {showCaptureMenu && (
          <div className="modal-overlay" onClick={() => setShowCaptureMenu(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Target Capture</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowCaptureMenu(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                {!captureState.isRunning ? (
                  <div className="capture-controls">
                    <div className="capture-settings-summary">
                      <p><strong>Settings:</strong> {captureSettings.count} frames, {captureSettings.interval_seconds}s interval, {captureSettings.exposure_time} exposure, ISO {captureSettings.iso}</p>
                    </div>
                    
                    <div className="modal-actions">
                      <Button onClick={handleStartCapture}>
                        Start Capture
                      </Button>
                      <Button 
                        onClick={() => setShowCaptureMenu(false)}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="capture-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(captureState.current / captureState.total) * 100}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      {captureState.current} / {captureState.total} frames
                    </div>
                    
                    {captureState.latestImage && (
                      <div className="latest-image">
                        <h4>Latest Capture</h4>
                        <img 
                          src={captureState.latestImage} 
                          alt="Latest capture"
                          className="capture-preview"
                        />
                      </div>
                    )}
                    
                    <div className="modal-actions">
                      <Button onClick={handleStopCapture} variant="secondary">
                        Stop Capture
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calibration Menu Modal */}
        {showCalibrationMenu && (
          <div className="modal-overlay" onClick={() => setShowCalibrationMenu(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Calibration Frames</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowCalibrationMenu(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                {!calibrationState.isRunning ? (
                  <div className="calibration-controls">
                    <div className="calibration-buttons">
                      <Button
                        onClick={() => handleStartCalibration('bias')}
                        variant="secondary"
                        className="calibration-button"
                      >
                        <Settings size={16} className="mr-2" />
                        Bias Frames (20)
                      </Button>
                      <Button
                        onClick={() => handleStartCalibration('dark')}
                        variant="secondary"
                        className="calibration-button"
                      >
                        <Settings size={16} className="mr-2" />
                        Dark Frames (20)
                      </Button>
                      <Button
                        onClick={() => handleStartCalibration('flat')}
                        variant="secondary"
                        className="calibration-button"
                      >
                        <Settings size={16} className="mr-2" />
                        Flat Frames (20)
                      </Button>
                    </div>
                    
                    <div className="modal-actions">
                      <Button 
                        onClick={() => setShowCalibrationMenu(false)}
                        variant="secondary"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="calibration-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(calibrationState.current / calibrationState.total) * 100}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      {calibrationState.current} / {calibrationState.total} {calibrationState.type} frames
                    </div>
                    
                    {calibrationState.latestImage && (
                      <div className="latest-image">
                        <h4>Latest {calibrationState.type} Frame</h4>
                        <img 
                          src={calibrationState.latestImage} 
                          alt={`Latest ${calibrationState.type} frame`}
                          className="capture-preview"
                        />
                      </div>
                    )}
                    
                    <div className="modal-actions">
                      <Button onClick={handleStopCalibration} variant="secondary">
                        Stop Calibration
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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

      {/* Active Session Icons */}
      {activeSession && (
        <div className="active-session-icons">
          <div className="session-icon-group">
            <button
              onClick={() => setShowSettingsMenu(true)}
              className="session-icon-button"
              title="Settings"
            >
              <Cog className="h-6 w-6" />
            </button>
            <button
              onClick={() => setShowCalibrationMenu(true)}
              className="session-icon-button"
              title="Calibration"
            >
              <Zap className="h-6 w-6" />
            </button>
            <button
              onClick={() => setShowCaptureMenu(true)}
              className="session-icon-button"
              title="Capture"
            >
              <Camera className="h-6 w-6" />
            </button>
          </div>
          <div className="active-session-info">
            <span className="active-session-name">{activeSession.name}</span>
            <span className="active-session-target">Target: {activeSession.target}</span>
          </div>
        </div>
      )}

      <SessionList
        sessions={transformedSessions}
        activeSessionId={activeSessionId}
        onActivateSession={handleActivateSession}
        onDeleteSession={handleDeleteSession}
      />

      {showCreateForm && (
        <Card title="Create New Session" className="mt-6">
          <div className="space-y-4">
            <div className="form-group">
              <label>Target Object</label>
              <Select
                value={targetObject}
                onChange={(e) => setTargetObject(e.target.value)}
              >
                <option value="">Select a target...</option>
                {COMMON_TARGETS.map(target => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </Select>
            </div>

            {targetObject === 'custom' && (
              <div className="form-group">
                <label>Custom Target Name</label>
                <Input
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  placeholder="Enter target name (e.g., NGC 7000)"
                />
              </div>
            )}

            {createError && (
              <div className="error-message">
                {createError}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleCreateSession}
                loading={isCreating}
                disabled={!targetObject || (targetObject === 'custom' && !customTarget)}
              >
                Create Session
              </Button>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Settings Menu Modal */}
      {showSettingsMenu && (
        <div className="modal-overlay" onClick={() => setShowSettingsMenu(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Session Settings</h3>
              <button 
                className="modal-close"
                onClick={() => setShowSettingsMenu(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="settings-section">
                <h4>Capture Settings</h4>
                <div className="form-group">
                  <label>Frame Count</label>
                  <Input
                    type="number"
                    value={captureSettings.count}
                    onChange={(e) => setCaptureSettings(prev => ({
                      ...prev,
                      count: parseInt(e.target.value) || 10
                    }))}
                    min="1"
                    max="1000"
                  />
                </div>
                
                <div className="form-group">
                  <label>Interval (seconds)</label>
                  <Input
                    type="number"
                    value={captureSettings.interval_seconds}
                    onChange={(e) => setCaptureSettings(prev => ({
                      ...prev,
                      interval_seconds: parseInt(e.target.value) || 5
                    }))}
                    min="1"
                    max="300"
                  />
                </div>
                
                <div className="form-group">
                  <label>Exposure Time</label>
                  <Input
                    value={captureSettings.exposure_time}
                    onChange={(e) => setCaptureSettings(prev => ({
                      ...prev,
                      exposure_time: e.target.value
                    }))}
                    placeholder="e.g., 60s"
                  />
                </div>
                
                <div className="form-group">
                  <label>ISO</label>
                  <Input
                    type="number"
                    value={captureSettings.iso}
                    onChange={(e) => setCaptureSettings(prev => ({
                      ...prev,
                      iso: parseInt(e.target.value) || 800
                    }))}
                    min="100"
                    max="6400"
                  />
                </div>
              </div>
              
              <div className="modal-actions">
                <Button onClick={() => setShowSettingsMenu(false)}>
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capture Menu Modal */}
      {showCaptureMenu && (
        <div className="modal-overlay" onClick={() => setShowCaptureMenu(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Target Capture</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCaptureMenu(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {!captureState.isRunning ? (
                <div className="capture-controls">
                  <div className="capture-settings-summary">
                    <p><strong>Settings:</strong> {captureSettings.count} frames, {captureSettings.interval_seconds}s interval, {captureSettings.exposure_time} exposure, ISO {captureSettings.iso}</p>
                  </div>
                  
                  <div className="modal-actions">
                    <Button onClick={handleStartCapture}>
                      Start Capture
                    </Button>
                    <Button 
                      onClick={() => setShowCaptureMenu(false)}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="capture-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${(captureState.current / captureState.total) * 100}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {captureState.current} / {captureState.total} frames
                  </div>
                  
                  {captureState.latestImage && (
                    <div className="latest-image">
                      <h4>Latest Capture</h4>
                      <img 
                        src={captureState.latestImage} 
                        alt="Latest capture"
                        className="capture-preview"
                      />
                    </div>
                  )}
                  
                  <div className="modal-actions">
                    <Button onClick={handleStopCapture} variant="secondary">
                      Stop Capture
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calibration Menu Modal */}
      {showCalibrationMenu && (
        <div className="modal-overlay" onClick={() => setShowCalibrationMenu(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Calibration Frames</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCalibrationMenu(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {!calibrationState.isRunning ? (
                <div className="calibration-controls">
                  <div className="calibration-buttons">
                    <Button
                      onClick={() => handleStartCalibration('bias')}
                      variant="secondary"
                      className="calibration-button"
                    >
                      <Settings size={16} className="mr-2" />
                      Bias Frames (20)
                    </Button>
                    <Button
                      onClick={() => handleStartCalibration('dark')}
                      variant="secondary"
                      className="calibration-button"
                    >
                      <Settings size={16} className="mr-2" />
                      Dark Frames (20)
                    </Button>
                    <Button
                      onClick={() => handleStartCalibration('flat')}
                      variant="secondary"
                      className="calibration-button"
                    >
                      <Settings size={16} className="mr-2" />
                      Flat Frames (20)
                    </Button>
                  </div>
                  
                  <div className="modal-actions">
                    <Button 
                      onClick={() => setShowCalibrationMenu(false)}
                      variant="secondary"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="calibration-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${(calibrationState.current / calibrationState.total) * 100}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {calibrationState.current} / {calibrationState.total} {calibrationState.type} frames
                  </div>
                  
                  {calibrationState.latestImage && (
                    <div className="latest-image">
                      <h4>Latest {calibrationState.type} Frame</h4>
                      <img 
                        src={calibrationState.latestImage} 
                        alt={`Latest ${calibrationState.type} frame`}
                        className="capture-preview"
                      />
                    </div>
                  )}
                  
                  <div className="modal-actions">
                    <Button onClick={handleStopCalibration} variant="secondary">
                      Stop Calibration
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 