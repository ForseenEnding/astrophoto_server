import { Calendar, MoreVertical, Settings, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'

interface CameraPreset {
  name: string
  label: string
  description?: string
  created_at: string
  configs: Record<string, any>
}

interface PresetCardProps {
  preset: CameraPreset
  onApply: () => void
  onDelete: () => void
  isApplying: boolean
  isDeleting: boolean
}

export function PresetCard({ preset, onApply, onDelete, isApplying, isDeleting }: PresetCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Unknown date'
    }
  }

  const configCount = Object.keys(preset.configs).length

  return (
    <div className="preset-card">
      <div className="preset-card-header">
        <div className="preset-card-title">
          <h4>{preset.label}</h4>
          {preset.description && (
            <p className="preset-card-description">{preset.description}</p>
          )}
        </div>
        
        <div className="preset-card-menu">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="btn-menu"
            disabled={isApplying || isDeleting}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="preset-menu-dropdown">
              <button
                onClick={() => {
                  onDelete()
                  setShowMenu(false)
                }}
                disabled={isDeleting}
                className="preset-menu-item delete"
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="preset-card-info">
        <div className="preset-card-stat">
          <Settings className="w-3 h-3" />
          <span>{configCount} settings</span>
        </div>
        
        <div className="preset-card-stat">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(preset.created_at)}</span>
        </div>
      </div>

      <div className="preset-card-actions">
        <button
          onClick={onApply}
          disabled={isApplying || isDeleting}
          className="btn btn-primary btn-sm preset-apply-btn"
        >
          {isApplying ? (
            <>
              <div className="btn-spinner" />
              Applying...
            </>
          ) : (
            <>
              <Upload className="w-3 h-3 mr-1" />
              Apply Preset
            </>
          )}
        </button>
      </div>
    </div>
  )
}