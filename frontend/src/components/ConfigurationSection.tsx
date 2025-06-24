import { ChevronDown, ChevronRight, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { ConfigurationControl } from './ConfigurationControl'

interface CameraConfig {
  name: string
  type: string
  label?: string
  read_only: boolean
  value?: string
  choices: string[]
}

interface ConfigGroup {
  label: string
  description: string
  config_names: string[]
}

interface ConfigurationSectionProps {
  groupId: string
  group: ConfigGroup
  configs: Record<string, CameraConfig | null>
  onConfigChange: (configName: string, value: string) => void
  onBatchUpdate: (changes: Record<string, string>) => void
  isUpdating: boolean
}

export function ConfigurationSection({
  groupId,
  group,
  configs,
  onConfigChange,
  onBatchUpdate,
  isUpdating
}: ConfigurationSectionProps) {
  const [isExpanded, setIsExpanded] = useState(groupId === 'exposure')
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})

  // Get configs for this group, filtering out null/missing configs
  const groupConfigs = group.config_names
    .map(name => ({ name, config: configs[name] }))
    .filter(({ config }) => config !== null)

  const availableConfigs = groupConfigs.filter(({ config }) => config !== null) as Array<{
    name: string
    config: CameraConfig
  }>

  // Track which configs have pending changes
  const hasChanges = Object.keys(pendingChanges).length > 0
  const changeCount = Object.keys(pendingChanges).length

  const handleLocalChange = (configName: string, value: string) => {
    const originalValue = configs[configName]?.value || ''
    
    if (value === originalValue) {
      // Remove from pending changes if reverting to original value
      const newChanges = { ...pendingChanges }
      delete newChanges[configName]
      setPendingChanges(newChanges)
    } else {
      // Add to pending changes
      setPendingChanges(prev => ({
        ...prev,
        [configName]: value
      }))
    }
  }

  const handleApplyChanges = () => {
    if (hasChanges && !isUpdating) {
      onBatchUpdate(pendingChanges)
      setPendingChanges({}) // Clear pending changes after applying
    }
  }

  const handleResetChanges = () => {
    setPendingChanges({})
  }

  // Get current value for a config (pending change or original value)
  const getCurrentValue = (configName: string): string => {
    return pendingChanges[configName] ?? configs[configName]?.value ?? ''
  }

  return (
    <div className="config-section">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="config-section-header"
      >
        <div className="config-section-info">
          <div className="config-section-title">
            <h3>{group.label}</h3>
            {hasChanges && (
              <span className="config-changes-badge">
                {changeCount} change{changeCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="config-section-description">{group.description}</p>
          <span className="config-section-count">
            {availableConfigs.length} settings
          </span>
        </div>
        
        {isExpanded ? (
          <ChevronDown className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5" />
        )}
      </button>

      {isExpanded && (
        <div className="config-section-content">
          {/* Batch Actions */}
          {hasChanges && (
            <div className="config-batch-actions">
              <div className="config-batch-info">
                <span className="config-batch-text">
                  {changeCount} setting{changeCount !== 1 ? 's' : ''} modified
                </span>
              </div>
              
              <div className="config-batch-buttons">
                <button
                  onClick={handleResetChanges}
                  disabled={isUpdating}
                  className="btn btn-secondary btn-sm"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </button>
                
                <button
                  onClick={handleApplyChanges}
                  disabled={isUpdating}
                  className="btn btn-primary btn-sm"
                >
                  <Save className="w-3 h-3 mr-1" />
                  {isUpdating ? 'Applying...' : 'Apply Changes'}
                </button>
              </div>
            </div>
          )}

          {availableConfigs.length === 0 ? (
            <p className="config-section-empty">No available settings in this group</p>
          ) : (
            <div className="config-controls">
              {availableConfigs.map(({ name, config }) => (
                <ConfigurationControl
                  key={name}
                  config={{
                    ...config,
                    value: getCurrentValue(name) // Use current value (pending or original)
                  }}
                  onValueChange={(value) => handleLocalChange(name, value)}
                  isUpdating={isUpdating}
                  hasChanges={name in pendingChanges}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}