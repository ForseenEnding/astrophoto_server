import { Camera } from 'lucide-react'
import { Button } from '../ui/Button'

interface CaptureControlsProps {
  connected: boolean
  isCapturing: boolean
  captureError?: string
  onCapture: () => void
}

export function CaptureControls({ 
  connected, 
  isCapturing, 
  captureError, 
  onCapture 
}: CaptureControlsProps) {
  return (
    <div className="capture-controls">
      <div className="capture-button-container">
        <Button
          onClick={onCapture}
          disabled={!connected}
          loading={isCapturing}
          size="lg"
          className="capture-button"
        >
          <Camera size={20} />
          {isCapturing ? 'Capturing...' : 'Capture Image'}
        </Button>
      </div>
      
      {captureError && (
        <div className="error-message">
          {captureError}
        </div>
      )}
    </div>
  )
} 