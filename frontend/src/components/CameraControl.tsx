import { useCameraStatus } from '@/hooks/useCameraStatus'
import { Camera, Circle, Square, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { LivePreview } from './LivePreview'

interface CameraControlProps {
  compact?: boolean
}

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

  const [captureSettings, setCaptureSettings] = useState({
    savePath: 'test',
    imageName: '',
  })

  const handleToggleConnection = () => {
    if (status.connected) {
      disconnect()
    } else {
      connect()
    }
  }

  const handleCapture = () => {
    capture({
      save_to_path: captureSettings.savePath,
      image_name: captureSettings.imageName || `capture_${Date.now()}`,
    })
  }

  if (compact) {
    return (
      <div className="camera-control-compact">
        <h3>
          <Camera className="inline w-5 h-5 mr-2" />
          Camera
        </h3>
        <div className="flex items-center justify-between">
          <StatusIndicator connected={status.connected} />
          <button
            onClick={handleToggleConnection}
            disabled={isConnecting || isDisconnecting}
            className={`btn ${status.connected ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isConnecting || isDisconnecting ? (
              <Circle className="w-4 h-4 animate-spin" />
            ) : status.connected ? (
              <WifiOff className="w-4 h-4" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            {status.connected ? 'Disconnect' : 'Connect'}
          </button>
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

      {/* Status Section */}
      <div className="camera-status-section">
        <h3>Status</h3>
        <div className="camera-status-info">
          <StatusIndicator connected={status.connected} />
          
          {status.model && (
            <p><strong>Model:</strong> {status.model}</p>
          )}
          
          {status.battery && (
            <p><strong>Battery:</strong> {status.battery}</p>
          )}

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
        </div>

        {connectError && (
          <div className="error-message">
            Connection failed: {connectError.message}
          </div>
        )}
      </div>

      {/* Live Preview */}
      {status.connected && <LivePreview />}

      {/* Capture Section */}
      {status.connected && (
        <div className="capture-section">
          <h3>Capture Settings</h3>
          
          <div className="form-group">
            <label htmlFor="save-path">Save Path:</label>
            <input
              id="save-path"
              type="text"
              value={captureSettings.savePath}
              onChange={(e) => setCaptureSettings(prev => ({ ...prev, savePath: e.target.value }))}
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="image-name">Image Name (optional):</label>
            <input
              id="image-name"
              type="text"
              value={captureSettings.imageName}
              onChange={(e) => setCaptureSettings(prev => ({ ...prev, imageName: e.target.value }))}
              placeholder="Auto-generated if empty"
              className="input"
            />
          </div>

          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="btn btn-primary"
          >
            {isCapturing ? (
              <Circle className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            {isCapturing ? 'Capturing...' : 'Capture Image'}
          </button>

          {captureError && (
            <div className="error-message">
              Capture failed: {captureError.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusIndicator({ connected }: { connected: boolean }) {
  return (
    <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
      <Circle className={`w-3 h-3 ${connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  )
}