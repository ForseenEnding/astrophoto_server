import { Lock } from 'lucide-react'

interface CameraConfig {
  name: string
  type: string
  label?: string
  read_only: boolean
  value?: string
  choices: string[]
}

interface ConfigurationControlProps {
  config: CameraConfig
  onValueChange: (value: string) => void
  isUpdating: boolean
  hasChanges?: boolean
}

export function ConfigurationControl({
  config,
  onValueChange,
  isUpdating,
  hasChanges = false
}: ConfigurationControlProps) {
  const handleChange = (value: string) => {
    if (!config.read_only && !isUpdating) {
      onValueChange(value)
    }
  }

  const renderControl = () => {
    // Read-only configs
    if (config.read_only) {
      return (
        <div className="config-control-readonly">
          <input
            type="text"
            value={config.value || ''}
            disabled
            className="input config-input readonly"
          />
          <Lock className="w-4 h-4 text-gray-400 ml-2" />
        </div>
      )
    }

    // Dropdown for configs with choices
    if (config.choices && config.choices.length > 0) {
      return (
        <select
          value={config.value || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isUpdating}
          className={`input config-select ${hasChanges ? 'has-changes' : ''}`}
        >
          {config.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      )
    }

    // Text input for other configs
    return (
      <input
        type="text"
        value={config.value || ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isUpdating}
        className={`input config-input ${hasChanges ? 'has-changes' : ''}`}
      />
    )
  }

  return (
    <div className={`config-control ${hasChanges ? 'has-changes' : ''}`}>
      <div className="config-control-label">
        <label>{config.label || config.name}</label>
        <div className="config-control-badges">
          {hasChanges && (
            <span className="config-changed-badge">Modified</span>
          )}
          {config.read_only && (
            <span className="config-readonly-badge">Read Only</span>
          )}
        </div>
      </div>
      
      <div className="config-control-input">
        {renderControl()}
      </div>
    </div>
  )
}