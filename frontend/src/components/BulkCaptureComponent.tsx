import { useCameraStatus } from '@/hooks/useCameraStatus'
import { useSessions } from '@/hooks/useSessions'
import { AlertCircle, Camera, CheckCircle, Clock, Pause, Play, Square, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// Types for bulk capture
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

// API class for bulk capture
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

export function BulkCaptureControl() {
  const { status: cameraStatus } = useCameraStatus()
  const { sessions, activeSessionId } = useSessions()
  
  // Form state
  const [captureCount, setCaptureCount] = useState(10)
  const [intervalSeconds, setIntervalSeconds] = useState(3)
  const [useActiveSession, setUseActiveSession] = useState(true)
  const [customBaseName, setCustomBaseName] = useState('')
  
  // Job state
  const [currentJob, setCurrentJob] = useState<BulkCaptureStatus | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const statusIntervalRef = useRef<number | null>(null)
  
  const activeSession = sessions.find(session => session.id === activeSessionId)

  // Poll job status
  useEffect(() => {
    if (currentJob && ['running', 'paused'].includes(currentJob.status)) {
      statusIntervalRef.current = window.setInterval(async () => {
        try {
          const status = await bulkCaptureAPI.getStatus(currentJob.job_id)
          setCurrentJob(status)
          
          // Stop polling if job is complete
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
  }, [currentJob])

  const handleStartBulkCapture = async () => {
    if (!cameraStatus.connected) {
      setError('Camera must be connected to start bulk capture')
      return
    }

    setIsStarting(true)
    setError(null)

    try {
      const request: BulkCaptureRequest = {
        count: captureCount,
        interval_seconds: intervalSeconds,
        session_id: useActiveSession && activeSession ? activeSession.id : undefined,
        base_name: customBaseName || undefined
      }

      const response = await bulkCaptureAPI.startBulkCapture(request)
      setCurrentJob(response.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bulk capture')
    } finally {
      setIsStarting(false)
    }
  }

  const handlePauseJob = async () => {
    if (!currentJob) return
    
    try {
      await bulkCaptureAPI.pauseJob(currentJob.job_id)
      setCurrentJob({ ...currentJob, status: 'paused' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause job')
    }
  }

  const handleResumeJob = async () => {
    if (!currentJob) return
    
    try {
      await bulkCaptureAPI.resumeJob(currentJob.job_id)
      setCurrentJob({ ...currentJob, status: 'running' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume job')
    }
  }

  const handleCancelJob = async () => {
    if (!currentJob) return
    
    try {
      await bulkCaptureAPI.cancelJob(currentJob.job_id)
      setCurrentJob({ ...currentJob, status: 'cancelled' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job')
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

  return (
    <div className="bulk-capture-control">
      <h2>
        <Camera className="inline w-6 h-6 mr-2" />
        Bulk Capture
      </h2>

      {!currentJob || ['completed', 'cancelled', 'error'].includes(currentJob.status) ? (
        /* Setup Form */
        <div className="bulk-capture-setup">
          <div className="form-section">
            <h3>Capture Settings</h3>
            
            <div className="form-group">
              <label htmlFor="capture-count">Number of Images:</label>
              <input
                id="capture-count"
                type="number"
                min="1"
                max="1000"
                value={captureCount}
                onChange={(e) => setCaptureCount(parseInt(e.target.value) || 1)}
                className="input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="interval-seconds">Interval Between Captures (seconds):</label>
              <input
                id="interval-seconds"
                type="number"
                min="0"
                max="3600"
                step="0.1"
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(parseFloat(e.target.value) || 0)}
                className="input"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useActiveSession}
                  onChange={(e) => setUseActiveSession(e.target.checked)}
                  className="checkbox"
                />
                Use Active Session
                {activeSession && (
                  <span className="session-info">({activeSession.name})</span>
                )}
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="custom-base-name">Custom Base Name (optional):</label>
              <input
                id="custom-base-name"
                type="text"
                value={customBaseName}
                onChange={(e) => setCustomBaseName(e.target.value)}
                placeholder="e.g., M31_lights"
                className="input"
              />
            </div>
          </div>

          <div className="capture-summary">
            <h4>Summary</h4>
            <div className="summary-item">
              <span>Images to capture:</span>
              <span className="summary-value">{captureCount}</span>
            </div>
            <div className="summary-item">
              <span>Interval:</span>
              <span className="summary-value">{intervalSeconds}s</span>
            </div>
            <div className="summary-item">
              <span>Total time:</span>
              <span className="summary-value">
                {Math.floor((captureCount - 1) * intervalSeconds / 60)}m {((captureCount - 1) * intervalSeconds % 60).toFixed(0)}s
              </span>
            </div>
            <div className="summary-item">
              <span>Destination:</span>
              <span className="summary-value">
                {useActiveSession && activeSession 
                  ? `${activeSession.name} session` 
                  : 'Default location'
                }
              </span>
            </div>
          </div>

          <button
            onClick={handleStartBulkCapture}
            disabled={!cameraStatus.connected || isStarting || captureCount < 1}
            className="btn btn-primary btn-lg start-capture-btn"
          >
            {isStarting ? (
              <>
                <Camera className="w-5 h-5 animate-pulse mr-2" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start Bulk Capture
              </>
            )}
          </button>
        </div>
      ) : (
        /* Active Job Status */
        <div className="bulk-capture-status">
          <div className="status-header">
            <div className="status-title">
              {getStatusIcon(currentJob.status)}
              <span className="status-text">
                {currentJob.status.charAt(0).toUpperCase() + currentJob.status.slice(1)}
              </span>
            </div>
            
            <div className="job-controls">
              {currentJob.status === 'running' && (
                <button onClick={handlePauseJob} className="btn btn-secondary btn-sm">
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </button>
              )}
              
              {currentJob.status === 'paused' && (
                <button onClick={handleResumeJob} className="btn btn-primary btn-sm">
                  <Play className="w-4 h-4 mr-1" />
                  Resume
                </button>
              )}
              
              {['running', 'paused'].includes(currentJob.status) && (
                <button onClick={handleCancelJob} className="btn btn-secondary btn-sm">
                  <Square className="w-4 h-4 mr-1" />
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(currentJob.progress / currentJob.total) * 100}%` }}
              />
            </div>
            <div className="progress-text">
              {currentJob.progress} / {currentJob.total} images
              ({Math.round((currentJob.progress / currentJob.total) * 100)}%)
            </div>
          </div>

          <div className="status-details">
            <div className="detail-row">
              <span>Successful:</span>
              <span className="success-count">{currentJob.successful_captures}</span>
            </div>
            <div className="detail-row">
              <span>Failed:</span>
              <span className="error-count">{currentJob.failed_captures}</span>
            </div>
            <div className="detail-row">
              <span>Remaining:</span>
              <span>{currentJob.remaining}</span>
            </div>
            {currentJob.estimated_completion && currentJob.status === 'running' && (
              <div className="detail-row">
                <Clock className="w-4 h-4 mr-1" />
                <span>Time remaining:</span>
                <span>{formatTimeRemaining(currentJob.estimated_completion)}</span>
              </div>
            )}
            {currentJob.last_capture && (
              <div className="detail-row">
                <span>Last capture:</span>
                <span>{new Date(currentJob.last_capture).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {currentJob.error_message && (
            <div className="error-section">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span>{currentJob.error_message}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  )
}