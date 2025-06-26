import { useEffect, useRef, useState } from 'react'
import { BulkCapturePanel } from './components/camera/BulkCapturePanel'
import type { BulkCaptureStatus } from './components/camera/CameraControl'
import { CameraControl } from './components/camera/CameraControl'
import { CaptureControls } from './components/camera/CaptureControls'
import { CameraConfiguration } from './components/config/CameraConfiguration'
import { ImageGallery } from './components/ImageGallery'
import { Navigation } from './components/Navigation'
import { NavigationStatusBar } from './components/NavigationStatusBar'
import { NightVisionToggle } from './components/NightVisionToggle'
import { SessionManager } from './components/sessions/SessionManager'
import { useCameraStatus } from './hooks/useCameraStatus'
import { useSessions } from './hooks/useSessions'

type ViewType = 'dashboard' | 'camera' | 'calibration' | 'sessions' | 'gallery' | 'configuration'

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')

  // Camera and session hooks for dashboard controls
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
  const activeSession = sessions.find(session => session.id === activeSessionId)

  // Bulk capture state/handlers (from CameraControl)
  const [currentBulkJob, setCurrentBulkJob] = useState<BulkCaptureStatus | null>(null)
  const [isBulkStarting, setIsBulkStarting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const statusIntervalRef = useRef<number | null>(null)

  // BulkCaptureAPI and SessionAPI (copied from CameraControl)
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

  const renderCurrentView = () => {
    switch (currentView) {
      case 'camera':
        return (
          <div className="full-screen-view">
            <CameraControl />
          </div>
        )
      case 'configuration':
        return (
          <div className="full-screen-view">
            <CameraConfiguration />
          </div>
        )
      case 'sessions':
        return (
          <div className="full-screen-view">
            <SessionManager />
          </div>
        )
      case 'gallery':
        return (
          <div className="full-screen-view">
            <ImageGallery />
          </div>
        )
      case 'calibration':
        return (
          <div className="full-screen-view">
            <div className="empty-state">
              <p>Calibration view will be implemented here.</p>
            </div>
          </div>
        )
      case 'dashboard':
      default:
        return (
          <div className="dashboard">
            <div className="dashboard-grid">
              <div className="dashboard-section">
                <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <h2 className="section-title">Camera Control</h2>
                  <div className="dashboard-camera-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem' }}>
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
                      compact={true}
                    />
                  </div>
                </div>
                <CameraControl compact />
              </div>
              <div className="dashboard-section">
                <SessionManager compact />
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Astrophotography Control</h1>
        <NavigationStatusBar />
        <div className="header-controls">
          <Navigation currentView={currentView} onViewChange={setCurrentView} />
          <NightVisionToggle />
        </div>
      </header>
      
      <main className="app-main">
        {renderCurrentView()}
      </main>
    </div>
  )
} 