import { CameraAPI } from '@/services/camera-api'
import { ExternalLink, Eye, Maximize2, Minimize2, RefreshCw, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const cameraAPI = new CameraAPI('/api/camera')

// FPS presets for preview refresh rate
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
  const [isAutoRefresh, setIsAutoRefresh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('cover')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedFps, setSelectedFps] = useState(1) // Default to 1 FPS
  
  // Use useRef to store the interval ID and make sure it persists
  const intervalRef = useRef<number | null>(null)
  // Use useRef to track if auto-refresh should be active
  const isAutoRefreshRef = useRef(false)

  // Get interval from selected FPS
  const currentInterval = FPS_PRESETS.find(preset => preset.value === selectedFps)?.interval || 1000

  // Wrap capturePreview in useCallback to prevent recreation on every render
  const capturePreview = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)
      
      const blob = await cameraAPI.getPreview()
      const url = URL.createObjectURL(blob)
      
      // Clean up previous URL to prevent memory leaks
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      
      setPreviewUrl(url)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture preview')
      console.error('Preview capture failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [previewUrl])

  const startAutoRefresh = useCallback(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    isAutoRefreshRef.current = true
    setIsAutoRefresh(true)
    
    // Capture immediately
    capturePreview()
    
    // Then set up interval for subsequent captures using current FPS setting
    intervalRef.current = window.setInterval(() => {
      // Double-check that auto-refresh is still enabled
      if (isAutoRefreshRef.current) {
        capturePreview()
      }
    }, currentInterval)
  }, [capturePreview, currentInterval])

  const stopAutoRefresh = useCallback(() => {
    isAutoRefreshRef.current = false
    setIsAutoRefresh(false)
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const toggleAutoRefresh = useCallback(() => {
    if (isAutoRefresh) {
      stopAutoRefresh()
    } else {
      startAutoRefresh()
    }
  }, [isAutoRefresh, startAutoRefresh, stopAutoRefresh])

  // Restart auto-refresh when FPS changes
  useEffect(() => {
    if (isAutoRefresh) {
      stopAutoRefresh()
      startAutoRefresh()
    }
  }, [selectedFps]) // Re-run when FPS changes

  const toggleFitMode = useCallback(() => {
    setFitMode(prev => prev === 'contain' ? 'cover' : 'contain')
  }, [])

  const openInNewWindow = useCallback(() => {
    if (!previewUrl) return
    
    const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Camera Preview - ${lastUpdate?.toLocaleString()}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                background-color: #000;
                display: flex;
                flex-direction: column;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              .header {
                color: #dc2626;
                margin-bottom: 20px;
                text-align: center;
              }
              .image-container {
                max-width: 100%;
                max-height: 80vh;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border: 1px solid #262626;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
              }
              .info {
                color: #7f1d1d;
                margin-top: 15px;
                font-size: 14px;
                text-align: center;
              }
              .controls {
                margin-top: 20px;
                display: flex;
                gap: 10px;
              }
              .btn {
                padding: 8px 16px;
                background-color: #dc2626;
                color: black;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
              }
              .btn:hover {
                background-color: #b91c1c;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Camera Preview</h1>
              <p>Captured: ${lastUpdate?.toLocaleString()}</p>
            </div>
            <div class="image-container">
              <img src="${previewUrl}" alt="Camera Preview" />
            </div>
            <div class="info">
              <p>Right-click the image to save or copy</p>
            </div>
            <div class="controls">
              <button class="btn" onclick="window.print()">Print</button>
              <button class="btn" onclick="window.close()">Close</button>
            </div>
          </body>
        </html>
      `)
      newWindow.document.close()
    }
  }, [previewUrl, lastUpdate])

  // Cleanup effect - runs when component unmounts or dependencies change
  useEffect(() => {
    return () => {
      // Stop auto-refresh when component unmounts
      isAutoRefreshRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Clean up blob URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, []) // Empty dependency array means this only runs on mount/unmount

  // Separate effect to clean up blob URLs when they change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <div className="live-preview">
      {/* Header with settings toggle */}
      {!previewUrl && (
        <div className="preview-header">
          <h3>
            <Eye className="inline w-4 h-4 mr-2" />
            Live Preview
          </h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn btn-secondary btn-sm"
            title="Preview settings"
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="preview-settings">
          <div className="form-group">
            <label htmlFor="fps-select">Refresh Rate:</label>
            <select
              id="fps-select"
              className="select"
              value={selectedFps}
              onChange={(e) => setSelectedFps(Number(e.target.value))}
            >
              {FPS_PRESETS.map(preset => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-help">
            Higher refresh rates provide smoother updates but use more bandwidth and CPU.
          </div>
        </div>
      )}

      <div className="preview-container">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Camera Preview"
              className="preview-image"
              style={{ objectFit: fitMode }}
              onError={() => setError('Failed to load preview image')}
              onLoad={() => setError(null)}
            />
            
            {/* Enhanced preview controls overlay */}
            <div className="preview-controls">
              <button
                onClick={capturePreview}
                className="btn overlay btn-secondary btn-sm"
                disabled={isAutoRefresh || isLoading}
                title="Refresh preview"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading' : 'Refresh'}
              </button>
              
              <button
                onClick={toggleAutoRefresh}
                className={`btn overlay btn-sm ${isAutoRefresh ? 'btn-primary' : 'btn-secondary'}`}
                title={isAutoRefresh ? `Stop auto-refresh (${selectedFps} FPS)` : `Start auto-refresh (${selectedFps} FPS)`}
              >
                {isAutoRefresh ? 'Stop Auto' : 'Auto'}
              </button>

              <button
                onClick={openInNewWindow}
                className="btn overlay btn-secondary btn-sm"
                title="Open image in new window for closer inspection"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open
              </button>

              <button
                onClick={toggleFitMode}
                className="btn overlay btn-secondary btn-sm"
                title={fitMode === 'cover' ? 'Fit image to container' : 'Stretch image to fill container'}
              >
                {fitMode === 'cover' ? (
                  <Minimize2 className="w-3 h-3 mr-1" />
                ) : (
                  <Maximize2 className="w-3 h-3 mr-1" />
                )}
                {fitMode === 'cover' ? 'Fit' : 'Fill'}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn overlay btn-secondary btn-sm"
                title="Preview settings"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>

            {/* Error overlay */}
            {error && (
              <div className="error-overlay">
                <p className="text-sm">{error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="preview-placeholder">
            <Eye className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm mb-4">
              {error ? 'Preview unavailable' : 'Click "Refresh" to capture preview'}
            </p>
            
            {/* Controls in placeholder */}
            <div className="preview-controls">
              <button
                onClick={capturePreview}
                className="btn btn-secondary btn-sm"
                disabled={isLoading}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading' : 'Refresh'}
              </button>
              
              <button
                onClick={toggleAutoRefresh}
                className={`btn btn-sm ${isAutoRefresh ? 'btn-primary' : 'btn-secondary'}`}
                title={`${isAutoRefresh ? 'Stop' : 'Start'} auto-refresh (${selectedFps} FPS)`}
              >
                {isAutoRefresh ? 'Stop Auto' : 'Auto'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="preview-info">
        {lastUpdate ? (
          <p className="text-xs">
            Last updated: {lastUpdate.toLocaleTimeString()}
            {isAutoRefresh && <span className="ml-2">(Auto-refreshing at {selectedFps} FPS)</span>}
            <span className="ml-2">
              • Display: {fitMode === 'cover' ? 'Stretch to Fill' : 'Fit to Container'}
            </span>
          </p>
        ) : (
          <p className="text-xs">No preview captured yet</p>
        )}
      </div>
    </div>
  )
}