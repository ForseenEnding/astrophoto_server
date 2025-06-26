import { Camera, Clock, Pause, Play, Square } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'

interface BulkCaptureStatus {
  job_id: string
  status: 'running' | 'paused' | 'completed' | 'cancelled' | 'error'
  progress: number
  total: number
  remaining: number
  successful_captures: number
  failed_captures: number
}

interface BulkCapturePanelProps {
  onStartBulkCapture: (count: number, interval: number) => Promise<void>
  onPauseBulkCapture: () => Promise<void>
  onResumeBulkCapture: () => Promise<void>
  onCancelBulkCapture: () => Promise<void>
  currentJob: BulkCaptureStatus | null
  isStarting: boolean
  error?: string
  compact?: boolean
}

export function BulkCapturePanel({
  onStartBulkCapture,
  onPauseBulkCapture,
  onResumeBulkCapture,
  onCancelBulkCapture,
  currentJob,
  isStarting,
  error,
  compact = false
}: BulkCapturePanelProps) {
  const [count, setCount] = useState(10)
  const [interval, setInterval] = useState(3)
  const [showPopup, setShowPopup] = useState(false)

  const handleStart = () => {
    onStartBulkCapture(count, interval)
    setShowPopup(false)
  }

  const isRunning = currentJob?.status === 'running'
  const isPaused = currentJob?.status === 'paused'

  if (compact) {
    return (
      <div className="bulk-capture-compact">
        {!currentJob ? (
          <div className="bulk-capture-button-container">
            <Button
              onClick={() => setShowPopup(true)}
              variant="secondary"
              size="sm"
              className="bulk-trigger-btn"
            >
              <Camera size={16} />
              Bulk
            </Button>
            
            {/* Popup Modal */}
            {showPopup && (
              <div className="modal-overlay" onClick={() => setShowPopup(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Bulk Capture Settings</h3>
                    <button 
                      className="modal-close"
                      onClick={() => setShowPopup(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="bulk-inputs">
                      <Input
                        label="Number of images"
                        type="number"
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        min={1}
                        max={1000}
                      />
                      <Input
                        label="Interval (seconds)"
                        type="number"
                        value={interval}
                        onChange={(e) => setInterval(Number(e.target.value))}
                        min={1}
                        max={300}
                      />
                    </div>
                    <div className="bulk-popup-actions">
                      <Button
                        onClick={() => setShowPopup(false)}
                        variant="secondary"
                        size="sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleStart}
                        loading={isStarting}
                        size="sm"
                      >
                        Start Bulk Capture
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bulk-capture-status">
            <div className="bulk-progress-info">
              <span className="bulk-progress-text">
                {currentJob.progress}/{currentJob.total}
              </span>
              <div className="bulk-progress-bar">
                <div 
                  className="bulk-progress-fill"
                  style={{ width: `${(currentJob.progress / currentJob.total) * 100}%` }}
                />
              </div>
            </div>
            <div className="bulk-controls">
              {isRunning && (
                <Button onClick={onPauseBulkCapture} variant="secondary" size="sm">
                  <Pause size={14} />
                </Button>
              )}
              {isPaused && (
                <Button onClick={onResumeBulkCapture} variant="success" size="sm">
                  <Play size={14} />
                </Button>
              )}
              <Button onClick={onCancelBulkCapture} variant="danger" size="sm">
                <Square size={14} />
              </Button>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bulk-error-compact">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card title="Bulk Capture" className="space-y-4">
      {!currentJob ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Number of images"
              type="number"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              min={1}
              max={1000}
            />
            <Input
              label="Interval (seconds)"
              type="number"
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              min={1}
              max={300}
            />
          </div>
          <Button
            onClick={handleStart}
            loading={isStarting}
            className="w-full"
          >
            Start Bulk Capture
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                {currentJob.progress} / {currentJob.total} images
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {currentJob.successful_captures} successful, {currentJob.failed_captures} failed
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentJob.progress / currentJob.total) * 100}%` }}
            />
          </div>
          
          <div className="flex space-x-2">
            {isRunning && (
              <Button onClick={onPauseBulkCapture} variant="secondary" size="sm">
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            {isPaused && (
              <Button onClick={onResumeBulkCapture} variant="success" size="sm">
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            )}
            <Button onClick={onCancelBulkCapture} variant="danger" size="sm">
              <Square className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </Card>
  )
} 