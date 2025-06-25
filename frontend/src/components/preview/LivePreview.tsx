import { ExternalLink, Pause, Play, RefreshCw, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [isAutoRefresh, setIsAutoRefresh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedFps, setSelectedFps] = useState(1)
  
  const intervalRef = useRef<number | null>(null)
  const isAutoRefreshRef = useRef(false)

  const currentInterval = FPS_PRESETS.find(preset => preset.value === selectedFps)?.interval || 1000

  const capturePreview = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)
      
      const blob = await cameraAPI.getPreview()
      const url = URL.createObjectURL(blob)
      
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    isAutoRefreshRef.current = true
    setIsAutoRefresh(true)
    
    capturePreview()
    
    intervalRef.current = window.setInterval(() => {
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

  useEffect(() => {
    if (isAutoRefresh) {
      stopAutoRefresh()
      startAutoRefresh()
    }
  }, [selectedFps])

  const openInNewWindow = useCallback(() => {
    if (!previewUrl) return
    
    const newWindow = window.open('', '_blank', 'width=800,height=600')
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Camera Preview - ${lastUpdate?.toLocaleString()}</title>
            <style>
              body { margin: 0; padding: 20px; background: #000; color: #fff; font-family: sans-serif; }
              .container { max-width: 100%; max-height: 80vh; display: flex; flex-direction: column; align-items: center; }
              img { max-width: 100%; max-height: 100%; object-fit: contain; border: 1px solid #333; border-radius: 8px; }
              .info { margin-top: 15px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Camera Preview</h1>
              <img src="${previewUrl}" alt="Camera Preview" />
              <div class="info">
                <p>Captured: ${lastUpdate?.toLocaleString()}</p>
                <p>Right-click to save or copy</p>
              </div>
            </div>
          </body>
        </html>
      `)
      newWindow.document.close()
    }
  }, [previewUrl, lastUpdate])

  useEffect(() => {
    return () => {
      isAutoRefreshRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <Card title="Live Preview" headerActions={
      <div className="flex items-center space-x-2">
        <Button
          onClick={toggleAutoRefresh}
          variant={isAutoRefresh ? 'danger' : 'primary'}
          size="sm"
          loading={isLoading}
        >
          {isAutoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          onClick={capturePreview}
          disabled={isLoading}
          size="sm"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => setShowSettings(!showSettings)}
          variant="secondary"
          size="sm"
        >
          <Settings className="w-4 h-4" />
        </Button>
        {previewUrl && (
          <Button
            onClick={openInNewWindow}
            variant="secondary"
            size="sm"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
      </div>
    }>
      <div className="space-y-4">
        {showSettings && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Select
              label="Refresh Rate"
              value={selectedFps}
              onChange={(e) => setSelectedFps(Number(e.target.value))}
            >
              {FPS_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Camera Preview"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-gray-500 text-center">
              <p>No preview available</p>
              <p className="text-sm">Click refresh to capture</p>
            </div>
          )}
          
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-white" />
            </div>
          )}
        </div>

        {lastUpdate && (
          <div className="text-xs text-gray-500 text-center">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>
    </Card>
  )
} 