import { useState } from 'react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface CameraConfig {
  name: string
  type: string
  label?: string
  read_only: boolean
  value?: string
  choices: string[]
}

interface ConfigControlProps {
  config: CameraConfig
  onValueChange: (value: string) => void
  isUpdating?: boolean
  hasChanges?: boolean
}

export function ConfigControl({ 
  config, 
  onValueChange, 
  isUpdating = false,
  hasChanges = false 
}: ConfigControlProps) {
  const [localValue, setLocalValue] = useState(config.value || '')

  const handleChange = (value: string) => {
    setLocalValue(value)
    onValueChange(value)
  }

  const renderControl = () => {
    if (config.read_only) {
      return (
        <Input
          label={config.label || config.name}
          value={localValue}
          disabled
          className="opacity-60"
        />
      )
    }

    switch (config.type) {
      case 'enum':
        return (
          <Select
            label={config.label || config.name}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isUpdating}
          >
            {config.choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </Select>
        )
      
      case 'int':
      case 'float':
        return (
          <Input
            label={config.label || config.name}
            type="number"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isUpdating}
          />
        )
      
      default:
        return (
          <Input
            label={config.label || config.name}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isUpdating}
          />
        )
    }
  }

  return (
    <div className={`config-control ${hasChanges ? 'border-l-4 border-blue-500 pl-4' : ''}`}>
      {renderControl()}
      {hasChanges && (
        <div className="text-xs text-blue-600 mt-1">
          Modified
        </div>
      )}
    </div>
  )
} 