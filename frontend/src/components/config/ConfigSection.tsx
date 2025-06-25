import { ChevronDown, ChevronRight, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfigControl } from './ConfigControl'

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

interface ConfigSectionProps {
  groupId: string
  group: ConfigGroup
  configs: Record<string, CameraConfig | null>
  onBatchUpdate: (changes: Record<string, string>) => void
  isUpdating: boolean
}

export function ConfigSection({
  groupId,
  group,
  configs,
  onBatchUpdate,
  isUpdating
}: ConfigSectionProps) {
  const [isExpanded, setIsExpanded] = useState(groupId === 'exposure')
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})

  // Get configs for this group, filtering out null/missing configs
  const availableConfigs = group.config_names
    .map(name => ({ name, config: configs[name] }))
    .filter(({ config }) => config !== null) as Array<{
      name: string
      config: CameraConfig
    }>

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
      setPendingChanges({})
    }
  }

  const handleResetChanges = () => {
    setPendingChanges({})
  }

  const getCurrentValue = (configName: string): string => {
    return pendingChanges[configName] ?? configs[configName]?.value ?? ''
  }

  return (
    <Card className="mb-4">
      <div 
        className="cursor-pointer p-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {group.label}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {group.description}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-xs text-gray-500">
                {availableConfigs.length} settings
              </span>
              {hasChanges && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {changeCount} change{changeCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {/* Batch Actions */}
          {hasChanges && (
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {changeCount} setting{changeCount !== 1 ? 's' : ''} modified
              </span>
              <div className="flex space-x-2">
                <Button
                  onClick={handleResetChanges}
                  disabled={isUpdating}
                  variant="secondary"
                  size="sm"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
                <Button
                  onClick={handleApplyChanges}
                  disabled={isUpdating}
                  loading={isUpdating}
                  size="sm"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Apply Changes
                </Button>
              </div>
            </div>
          )}

          {availableConfigs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No available settings in this group
            </p>
          ) : (
            <div className="space-y-4">
              {availableConfigs.map(({ name, config }) => (
                <ConfigControl
                  key={name}
                  config={{
                    ...config,
                    value: getCurrentValue(name)
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
    </Card>
  )
} 