import { Camera, Wifi, WifiOff } from 'lucide-react'
import { Button } from '../ui/Button'

interface CameraStatusProps {
  connected: boolean
  isConnecting: boolean
  isDisconnecting: boolean
  connectError?: string
  onToggleConnection: () => void
}

export function CameraStatus({ 
  connected, 
  isConnecting, 
  isDisconnecting, 
  connectError, 
  onToggleConnection 
}: CameraStatusProps) {
  return (
    <div className="status-indicator">
      <div className="status-indicator">
        <Camera size={20} />
        {connected ? (
          <Wifi size={16} className="connected" />
        ) : (
          <WifiOff size={16} className="disconnected" />
        )}
        <span className="status-text">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <Button
        onClick={onToggleConnection}
        variant={connected ? 'danger' : 'primary'}
        loading={isConnecting || isDisconnecting}
        size="sm"
      >
        {connected ? 'Disconnect' : 'Connect'}
      </Button>
      
      {connectError && (
        <span className="error-message">{connectError}</span>
      )}
    </div>
  )
} 