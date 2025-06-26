import { Maximize2, Minimize2, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CameraAPI } from '../../services/camera-api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Select } from '../ui/Select'

const cameraAPI = new CameraAPI('/api/camera')

const FPS_PRESETS = [
  { value: 0.5, label: '0.5 FPS', interval: 2000 },
  { value: 1, label: '1 FPS', interval: 1000 },
  { value: 2, label: '2 FPS', interval: 500 },
  { value: 5, label: '5 FPS', interval: 200 },
  { value: 10, label: '10 FPS', interval: 100 }
]

export function LivePreview() {
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFps, setSelectedFps] = useState(1)
  const [fitMode, setFitMode] = useState<'fill' | 'fit'>('fill')
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const currentInterval = FPS_PRESETS.find(preset => preset.value === selectedFps)?.interval || 1000

  const fetchPreview = async () => {
    try {
      setError(null)
      // Don't set loading to true for auto-refresh to prevent flashing
      // Only show loading on initial load or manual refresh
      if (!previewUrl) {
        setIsLoading(true)
      }
      
      const blob = await cameraAPI.getPreview()
      const url = URL.createObjectURL(blob)
      
      setPreviewUrl(prevUrl => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl)
        }
        return url
      })
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture preview')
      console.error('Preview capture failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const startPreview = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    setIsRunning(true)
    fetchPreview()
    
    intervalRef.current = setInterval(fetchPreview, currentInterval)
  }

  const stopPreview = () => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const togglePreview = () => {
    if (isRunning) {
      stopPreview()
    } else {
      startPreview()
    }
  }

  const toggleFitMode = () => {
    setFitMode(prev => prev === 'fill' ? 'fit' : 'fill')
  }

  // Start preview on mount
  useEffect(() => {
    startPreview()
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [])

  // Restart when FPS changes
  useEffect(() => {
    if (isRunning) {
      startPreview()
    }
  }, [selectedFps])

  return (
    <Card>
      <div className="preview-content">
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        <div className="preview-container">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Camera Preview"
              className={`preview-image preview-image-${fitMode}`}
            />
          ) : (
            <div className="preview-placeholder">
              <p>No preview available</p>
              <p>Click refresh to capture</p>
            </div>
          )}
          
          {/* Overlay Controls - Always visible */}
          <div className="preview-overlay-controls">
            <div className="overlay-controls-group">
              <Button
                onClick={togglePreview}
                variant={isRunning ? 'danger' : 'primary'}
                size="sm"
                loading={isLoading && !previewUrl}
                className="overlay-button"
              >
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
              </Button>
              
              <Select
                value={selectedFps}
                onChange={(e) => setSelectedFps(Number(e.target.value))}
                className="fps-select"
              >
                {FPS_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </Select>
              
              <Button
                onClick={toggleFitMode}
                variant="secondary"
                size="sm"
                className="overlay-button"
                title={`Current: ${fitMode === 'fill' ? 'Fill' : 'Fit'} Mode - Click to switch to ${fitMode === 'fill' ? 'Fit' : 'Fill'} Mode`}
              >
                {fitMode === 'fill' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </Button>
            </div>
          </div>
          
          {/* Timestamp overlay - bottom left */}
          {lastUpdate && (
            <div className="preview-timestamp-overlay">
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          
          {/* Subtle loading indicator - only for initial load */}
          {isLoading && !previewUrl && (
            <div className="preview-loading-subtle">
              <div className="loading-dot"></div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
} 