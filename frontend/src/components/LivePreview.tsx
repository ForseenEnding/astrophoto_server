import { CameraAPI } from '@/services/camera-api'
import { Eye, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const cameraAPI = new CameraAPI('/api/camera')

export function LivePreview() {
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const capturePreview = async () => {
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
  }

  const startAutoRefresh = () => {
    if (intervalRef.current) return
    
    setIsAutoRefresh(true)
    intervalRef.current = window.setInterval(capturePreview, 500) // Every 3 seconds
  }

  const stopAutoRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsAutoRefresh(false)
  }

  const toggleAutoRefresh = () => {
    if (isAutoRefresh) {
      stopAutoRefresh()
    } else {
      startAutoRefresh()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <div className="live-preview">
      {/* Only show header when no image is loaded */}
      {!previewUrl && (
        <div className="preview-header">
          <h3>
            <Eye className="inline w-4 h-4 mr-2" />
            Live Preview
          </h3>
        </div>
      )}

      <div className="preview-container">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Camera Preview"
              className="preview-image"
              onError={() => setError('Failed to load preview image')}
              onLoad={() => setError(null)}
            />
            
            {/* Move existing controls to overlay position */}
            <div className="preview-controls">
              <button
                onClick={capturePreview}
                className="btn overlay btn-secondary btn-sm"
                disabled={isAutoRefresh || isLoading}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading' : 'Refresh'}
              </button>
              
              <button
                onClick={toggleAutoRefresh}
                className={`btn overlay btn-sm ${isAutoRefresh ? 'btn-primary' : 'btn-secondary'}`}
              >
                {isAutoRefresh ? 'Stop Auto' : 'Auto'}
              </button>
            </div>
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
              >
                {isAutoRefresh ? 'Stop Auto' : 'Auto'}
              </button>
            </div>
          </div>
        )}
        
        {error && (
          <div className="error-overlay">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      <div className="preview-info">
        {lastUpdate ? (
          <p className="text-xs">
            Last updated: {lastUpdate.toLocaleTimeString()}
            {isAutoRefresh && <span className="ml-2">(Auto-refreshing)</span>}
          </p>
        ) : (
          <p className="text-xs">No preview captured yet</p>
        )}
      </div>
    </div>
  )
}