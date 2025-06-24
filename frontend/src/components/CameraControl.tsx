import { useCameraStatus } from '@/hooks/useCameraStatus'
import { useSessions } from '@/hooks/useSessions'
import { AlertCircle, Camera, CheckCircle, Circle, Clock, Pause, Play, Square, Wifi, WifiOff, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LivePreview } from './LivePreview'

interface CameraControlProps {
  compact?: boolean
}

// Bulk capture types
interface BulkCaptureRequest {
  count: number
  interval_seconds: number
  session_id?: string
  base_name?: string
}

interface BulkCaptureStatus {
  job_id: string
  status: 'running' | 'paused' | 'completed' | 'cancelled' | 'error'
  progress: number
  total: number
  remaining: number
  current_interval: number
  estimated_completion?: string
  error_message?: string
  started_at: string
  last_capture?: string
  successful_captures: number
  failed_captures: number
}

interface BulkCaptureResponse {
  job_id: string
  message: string
  status: BulkCaptureStatus
}

// Bulk Capture API
class BulkCaptureAPI {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async startBulkCapture(request: BulkCaptureRequest): Promise<BulkCaptureResponse> {
    const response = await fetch(`${this.baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      throw new Error(`Failed to start bulk capture: ${response.statusText}`)
    }
    return response.json()
  }

  async getStatus(jobId: string): Promise<BulkCaptureStatus> {
    const response = await fetch(`${this.baseUrl}/${jobId}/status`)
    if (!response.ok) {
      throw new Error(`Failed to get bulk capture status: ${response.statusText}`)
    }
    return response.json()
  }

  async pauseJob(jobId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/${jobId}/pause`, { method: 'POST' })
    if (!response.ok) {
      throw new Error(`Failed to pause bulk capture: ${response.statusText}`)
    }
    return response.json()
  }

  async resumeJob(jobId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/${jobId}/resume`, { method: 'POST' })
    if (!response.ok) {
      throw new Error(`Failed to resume bulk capture: ${response.statusText}`)
    }
    return response.json()
  }

  async cancelJob(jobId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/${jobId}/cancel`, { method: 'POST' })
    if (!response.ok) {
      throw new Error(`Failed to cancel bulk capture: ${response.statusText}`)
    }
    return response.json()
  }
}

const bulkCaptureAPI = new BulkCaptureAPI('/api/bulk-capture')

// Session capture API
interface SessionCaptureRequest {
  image_name?: string
}

class SessionAPI {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async captureToSession(sessionId: string, request: SessionCaptureRequest) {
    const response = await fetch(`${this.baseUrl}/${sessionId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      throw new Error(`Failed to capture to session: ${response.statusText}`)
    }
    return response.json()
  }
}

const sessionAPI = new SessionAPI('/api/sessions')

export function CameraControl({ compact = false }: CameraControlProps) {
  const {
    status,
    connect,
    disconnect,
    capture,
    isConnecting,
    isDisconnecting,
    isCapturing,
    connectError,
    captureError,
  } = useCameraStatus()

  const { sessions, activeSessionId } = useSessions()

  // Bulk capture state
  const [showBulkCapture, setShowBulkCapture] = useState(false)
  const [bulkCaptureCount, setBulkCaptureCount] = useState(10)
  const [bulkCaptureInterval, setBulkCaptureInterval] = useState(3)
  const [currentBulkJob, setCurrentBulkJob] = useState<BulkCaptureStatus | null>(null)
  const [isBulkStarting, setIsBulkStarting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const statusIntervalRef = useRef<number | null>(null)
  const activeSession = sessions.find(session => session.id === activeSessionId)

  // Poll bulk capture status
  useEffect(() => {
    if (currentBulkJob && ['running', 'paused'].includes(currentBulkJob.status)) {
      statusIntervalRef.current = window.setInterval(async () => {
        try {
          const status = await bulkCaptureAPI.getStatus(currentBulkJob.job_id)
          setCurrentBulkJob(status)
          
          if (!['running', 'paused'].includes(status.status)) {
            if (statusIntervalRef.current) {
              clearInterval(statusIntervalRef.current)
              statusIntervalRef.current = null
            }
          }
        } catch (err) {
          console.error('Failed to get bulk capture status:', err)
        }
      }, 1000)
    }

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current)
        statusIntervalRef.current = null
      }
    }
  }, [currentBulkJob])

  const handleToggleConnection = () => {
    if (status.connected) {
      disconnect()
    } else {
      connect()
    }
  }

  const handleSingleCapture = async () => {
    if (activeSession) {
      try {
        await sessionAPI.captureToSession(activeSession.id, {
          image_name: `${activeSession.target}_${Date.now()}`
        })
      } catch (error) {
        console.error('Session capture failed:', error)
      }
    } else {
      capture({
        save_to_path: 'default',
        image_name: `capture_${Date.now()}`,
      })
    }
  }

  const handleStartBulkCapture = async () => {
    if (!status.connected) {
      setBulkError('Camera must be connected to start bulk capture')
      return
    }

    setIsBulkStarting(true)
    setBulkError(null)

    try {
      const request: BulkCaptureRequest = {
        count: bulkCaptureCount,
        interval_seconds: bulkCaptureInterval,
        session_id: activeSession?.id,
        base_name: activeSession?.target
      }

      const response = await bulkCaptureAPI.startBulkCapture(request)
      setCurrentBulkJob(response.status)
      setShowBulkCapture(false) // Hide setup form
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to start bulk capture')
    } finally {
      setIsBulkStarting(false)
    }
  }

  const handlePauseBulkJob = async () => {
    if (!currentBulkJob) return
    
    try {
      await bulkCaptureAPI.pauseJob(currentBulkJob.job_id)
      setCurrentBulkJob({ ...currentBulkJob, status: 'paused' })
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to pause job')
    }
  }

  const handleResumeBulkJob = async () => {
    if (!currentBulkJob) return
    
    try {
      await bulkCaptureAPI.resumeJob(currentBulkJob.job_id)
      setCurrentBulkJob({ ...currentBulkJob, status: 'running' })
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to resume job')
    }
  }

  const handleCancelBulkJob = async () => {
    if (!currentBulkJob) return
    
    try {
      await bulkCaptureAPI.cancelJob(currentBulkJob.job_id)
      setCurrentBulkJob({ ...currentBulkJob, status: 'cancelled' })
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to cancel job')
    }
  }

  const formatTimeRemaining = (estimatedCompletion?: string) => {
    if (!estimatedCompletion) return 'Unknown'
    
    const now = new Date()
    const completion = new Date(estimatedCompletion)
    const diffMs = completion.getTime() - now.getTime()
    
    if (diffMs <= 0) return 'Almost done'
    
    const diffSeconds = Math.floor(diffMs / 1000)
    const hours = Math.floor(diffSeconds / 3600)
    const minutes = Math.floor((diffSeconds % 3600) / 60)
    const seconds = diffSeconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-green-500" />
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Camera className="w-4 h-4" />
    }
  }

  if (compact) {
    return (
      <div className="camera-control-compact">
        <h3>
          <Camera className="inline w-5 h-5 mr-2" />
          Camera Control
        </h3>
        <div className="compact-controls">
          <div className="compact-button-group">
            <button
              onClick={handleToggleConnection}
              disabled={isConnecting || isDisconnecting}
              className={`btn ${status.connected ? 'btn-secondary' : 'btn-primary'}`}
            >
              {isConnecting || isDisconnecting ? (
                <Circle className="w-4 h-4 animate-spin mr-2" />
              ) : status.connected ? (
                <WifiOff className="w-4 h-4 mr-2" />
              ) : (
                <Wifi className="w-4 h-4 mr-2" />
              )}
              {isConnecting ? 'Connecting...' : isDisconnecting ? 'Disconnecting...' : 
               status.connected ? 'Disconnect' : 'Connect'}
            </button>
            
            {status.connected && (
              <button
                onClick={handleSingleCapture}
                disabled={isCapturing}
                className="btn btn-primary"
                title={activeSession ? `Capture to ${activeSession.name}` : 'Capture to default location'}
              >
                {isCapturing ? (
                  <Circle className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Square className="w-4 h-4 mr-2" />
                )}
                {isCapturing ? 'Capturing...' : 'Capture'}
              </button>
            )}
          </div>
          
          {(connectError || captureError) && (
            <div className="compact-error">
              {connectError && (
                <p className="error-text">Connection: {connectError.message}</p>
              )}
              {captureError && (
                <p className="error-text">Capture: {captureError.message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="camera-control">
      <h2>
        <Camera className="inline w-6 h-6 mr-2" />
        Camera Control
      </h2>

      {/* Connection Controls */}
      <div className="camera-connection-section">
        <div className="camera-button-group">
          <button
            onClick={handleToggleConnection}
            disabled={isConnecting || isDisconnecting}
            className={`btn ${status.connected ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isConnecting || isDisconnecting ? (
              <Circle className="w-4 h-4 animate-spin mr-2" />
            ) : status.connected ? (
              <WifiOff className="w-4 h-4 mr-2" />
            ) : (
              <Wifi className="w-4 h-4 mr-2" />
            )}
            {isConnecting ? 'Connecting...' : isDisconnecting ? 'Disconnecting...' : 
             status.connected ? 'Disconnect' : 'Connect'}
          </button>

          {status.connected && (
            <button
              onClick={handleSingleCapture}
              disabled={isCapturing}
              className="btn btn-primary btn-lg"
              title={activeSession ? `Capture to ${activeSession.name}` : 'Capture to default location'}
            >
              {isCapturing ? (
                <Circle className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Square className="w-5 h-5 mr-2" />
              )}
              {isCapturing ? 'Capturing...' : 'Single Capture'}
            </button>
          )}

          {status.connected && !currentBulkJob && (
            <button
              onClick={() => setShowBulkCapture(!showBulkCapture)}
              className="btn btn-secondary"
            >
              <Camera className="w-4 h-4 mr-2" />
              {showBulkCapture ? 'Hide Bulk' : 'Bulk Capture'}
            </button>
          )}
        </div>

        {connectError && (
          <div className="error-message">
            Connection failed: {connectError.message}
          </div>
        )}

        {captureError && (
          <div className="error-message">
            Capture failed: {captureError.message}
          </div>
        )}

        {bulkError && (
          <div className="error-message">
            <AlertCircle className="w-4 h-4 mr-2" />
            {bulkError}
          </div>
        )}
      </div>

      {/* Bulk Capture Setup */}
      {status.connected && showBulkCapture && !currentBulkJob && (
        <div className="bulk-capture-setup">
          <h3>Bulk Capture Setup</h3>
          
          <div className="bulk-setup-form">
            <div className="form-group">
              <label htmlFor="bulk-count">Number of Images:</label>
              <input
                id="bulk-count"
                type="number"
                min="1"
                max="1000"
                value={bulkCaptureCount}
                onChange={(e) => setBulkCaptureCount(parseInt(e.target.value) || 1)}
                className="input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="bulk-interval">Interval (seconds):</label>
              <input
                id="bulk-interval"
                type="number"
                min="0"
                max="3600"
                step="0.1"
                value={bulkCaptureInterval}
                onChange={(e) => setBulkCaptureInterval(parseFloat(e.target.value) || 0)}
                className="input"
              />
            </div>

            <div className="bulk-summary">
              <div className="summary-row">
                <span>Images:</span>
                <span className="summary-value">{bulkCaptureCount}</span>
              </div>
              <div className="summary-row">
                <span>Interval:</span>
                <span className="summary-value">{bulkCaptureInterval}s</span>
              </div>
              <div className="summary-row">
                <span>Total time:</span>
                <span className="summary-value">
                  {Math.floor((bulkCaptureCount - 1) * bulkCaptureInterval / 60)}m {((bulkCaptureCount - 1) * bulkCaptureInterval % 60).toFixed(0)}s
                </span>
              </div>
              <div className="summary-row">
                <span>Destination:</span>
                <span className="summary-value">
                  {activeSession ? activeSession.name : 'Default location'}
                </span>
              </div>
            </div>

            <div className="bulk-actions">
              <button
                onClick={handleStartBulkCapture}
                disabled={isBulkStarting || bulkCaptureCount < 1}
                className="btn btn-primary"
              >
                {isBulkStarting ? (
                  <>
                    <Circle className="w-4 h-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Bulk Capture
                  </>
                )}
              </button>

              <button
                onClick={() => setShowBulkCapture(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Bulk Capture Status */}
      {currentBulkJob && (
        <div className="bulk-capture-status">
          <div className="bulk-status-header">
            <div className="bulk-status-title">
              {getStatusIcon(currentBulkJob.status)}
              <span className="bulk-status-text">
                Bulk Capture: {currentBulkJob.status.charAt(0).toUpperCase() + currentBulkJob.status.slice(1)}
              </span>
            </div>
            
            <div className="bulk-job-controls">
              {currentBulkJob.status === 'running' && (
                <button onClick={handlePauseBulkJob} className="btn btn-secondary btn-sm">
                  <Pause className="w-3 h-3 mr-1" />
                  Pause
                </button>
              )}
              
              {currentBulkJob.status === 'paused' && (
                <button onClick={handleResumeBulkJob} className="btn btn-primary btn-sm">
                  <Play className="w-3 h-3 mr-1" />
                  Resume
                </button>
              )}
              
              {['running', 'paused'].includes(currentBulkJob.status) && (
                <button onClick={handleCancelBulkJob} className="btn btn-secondary btn-sm">
                  <XCircle className="w-3 h-3 mr-1" />
                  Cancel
                </button>
              )}

              {['completed', 'cancelled', 'error'].includes(currentBulkJob.status) && (
                <button 
                  onClick={() => setCurrentBulkJob(null)} 
                  className="btn btn-secondary btn-sm"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="bulk-progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(currentBulkJob.progress / currentBulkJob.total) * 100}%` }}
              />
            </div>
            <div className="progress-text">
              {currentBulkJob.progress} / {currentBulkJob.total} images
              ({Math.round((currentBulkJob.progress / currentBulkJob.total) * 100)}%)
            </div>
          </div>

          <div className="bulk-details">
            <div className="detail-grid">
              <div className="detail-item">
                <span>Successful:</span>
                <span className="success-count">{currentBulkJob.successful_captures}</span>
              </div>
              <div className="detail-item">
                <span>Failed:</span>
                <span className="error-count">{currentBulkJob.failed_captures}</span>
              </div>
              <div className="detail-item">
                <span>Remaining:</span>
                <span>{currentBulkJob.remaining}</span>
              </div>
              {currentBulkJob.estimated_completion && currentBulkJob.status === 'running' && (
                <div className="detail-item">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>Time left:</span>
                  <span>{formatTimeRemaining(currentBulkJob.estimated_completion)}</span>
                </div>
              )}
            </div>

            {currentBulkJob.error_message && (
              <div className="bulk-error">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>{currentBulkJob.error_message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Preview */}
      {status.connected && <LivePreview />}
    </div>
  )
}