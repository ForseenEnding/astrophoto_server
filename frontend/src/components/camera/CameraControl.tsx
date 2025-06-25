import { useEffect, useRef, useState } from 'react'
import { useCameraStatus } from '../../hooks/useCameraStatus'
import { useSessions } from '../../hooks/useSessions'
import { LivePreview } from '../preview/LivePreview'
import { BulkCapturePanel } from './BulkCapturePanel'
import { CameraStatus } from './CameraStatus'
import { CaptureControls } from './CaptureControls'

interface CameraControlProps {
  compact?: boolean
}

interface BulkCaptureStatus {
  job_id: string
  status: 'running' | 'paused' | 'completed' | 'cancelled' | 'error'
  progress: number
  total: number
  remaining: number
  successful_captures: number
  failed_captures: number
}

// Simplified API classes
class BulkCaptureAPI {
  async startBulkCapture(count: number, interval: number): Promise<{ job_id: string }> {
    const response = await fetch('/api/bulk-capture/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, interval_seconds: interval })
    })
    if (!response.ok) throw new Error('Failed to start bulk capture')
    return response.json()
  }

  async getStatus(jobId: string): Promise<BulkCaptureStatus> {
    const response = await fetch(`/api/bulk-capture/${jobId}/status`)
    if (!response.ok) throw new Error('Failed to get status')
    return response.json()
  }

  async pauseJob(jobId: string): Promise<void> {
    await fetch(`/api/bulk-capture/${jobId}/pause`, { method: 'POST' })
  }

  async resumeJob(jobId: string): Promise<void> {
    await fetch(`/api/bulk-capture/${jobId}/resume`, { method: 'POST' })
  }

  async cancelJob(jobId: string): Promise<void> {
    await fetch(`/api/bulk-capture/${jobId}/cancel`, { method: 'POST' })
  }
}

class SessionAPI {
  async captureToSession(sessionId: string, imageName?: string): Promise<void> {
    const response = await fetch(`/api/sessions/${sessionId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_name: imageName })
    })
    if (!response.ok) throw new Error('Failed to capture to session')
  }
}

const bulkCaptureAPI = new BulkCaptureAPI()
const sessionAPI = new SessionAPI()

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
        await sessionAPI.captureToSession(activeSession.id, `${activeSession.target}_${Date.now()}`)
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

  const handleStartBulkCapture = async (count: number, interval: number) => {
    setIsBulkStarting(true)
    setBulkError(null)
    try {
      const response = await bulkCaptureAPI.startBulkCapture(count, interval)
      const status = await bulkCaptureAPI.getStatus(response.job_id)
      setCurrentBulkJob(status)
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Failed to start bulk capture')
    } finally {
      setIsBulkStarting(false)
    }
  }

  const handlePauseBulkCapture = async () => {
    if (!currentBulkJob) return
    try {
      await bulkCaptureAPI.pauseJob(currentBulkJob.job_id)
      const status = await bulkCaptureAPI.getStatus(currentBulkJob.job_id)
      setCurrentBulkJob(status)
    } catch (error) {
      console.error('Failed to pause bulk capture:', error)
    }
  }

  const handleResumeBulkCapture = async () => {
    if (!currentBulkJob) return
    try {
      await bulkCaptureAPI.resumeJob(currentBulkJob.job_id)
      const status = await bulkCaptureAPI.getStatus(currentBulkJob.job_id)
      setCurrentBulkJob(status)
    } catch (error) {
      console.error('Failed to resume bulk capture:', error)
    }
  }

  const handleCancelBulkCapture = async () => {
    if (!currentBulkJob) return
    try {
      await bulkCaptureAPI.cancelJob(currentBulkJob.job_id)
      setCurrentBulkJob(null)
    } catch (error) {
      console.error('Failed to cancel bulk capture:', error)
    }
  }

  if (compact) {
    return (
      <div className="space-y-4">
        <CameraStatus
          connected={status.connected}
          isConnecting={isConnecting}
          isDisconnecting={isDisconnecting}
          connectError={connectError?.message}
          onToggleConnection={handleToggleConnection}
        />
        <CaptureControls
          connected={status.connected}
          isCapturing={isCapturing}
          captureError={captureError?.message}
          onCapture={handleSingleCapture}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <CameraStatus
            connected={status.connected}
            isConnecting={isConnecting}
            isDisconnecting={isDisconnecting}
            connectError={connectError?.message}
            onToggleConnection={handleToggleConnection}
          />
          <CaptureControls
            connected={status.connected}
            isCapturing={isCapturing}
            captureError={captureError?.message}
            onCapture={handleSingleCapture}
          />
          <BulkCapturePanel
            onStartBulkCapture={handleStartBulkCapture}
            onPauseBulkCapture={handlePauseBulkCapture}
            onResumeBulkCapture={handleResumeBulkCapture}
            onCancelBulkCapture={handleCancelBulkCapture}
            currentJob={currentBulkJob}
            isStarting={isBulkStarting}
            error={bulkError || undefined}
          />
        </div>
        
        <div>
          <LivePreview />
        </div>
      </div>
    </div>
  )
} 