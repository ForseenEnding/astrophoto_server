import { useCameraConfigGroups, useUpdateCameraConfig } from '@/hooks/useCameraConfig'
import { AlertCircle, Loader2 } from 'lucide-react'
import { ConfigurationSection } from './ConfigurationSection'

export function ConfigurationGroups() {
  const { data, isLoading, error } = useCameraConfigGroups()
  const updateConfig = useUpdateCameraConfig()

  const handleConfigChange = (configName: string, value: string) => {
    // Single config change (kept for backward compatibility if needed)
    updateConfig.mutate({
      configs: { [configName]: value }
    })
  }

  const handleBatchUpdate = (changes: Record<string, string>) => {
    // Batch config update
    updateConfig.mutate({
      configs: changes
    })
  }

  if (isLoading) {
    return (
      <div className="config-loading">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <p>Loading camera configuration...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="config-error">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p>Failed to load camera configuration</p>
        <p className="text-sm text-gray-500">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="config-empty">
        <p>No configuration data available</p>
      </div>
    )
  }

  const { groups, configs } = data

  return (
    <div className="configuration-groups">
      <div className="config-sections">
        {Object.entries(groups).map(([groupId, group]) => (
          <ConfigurationSection
            key={groupId}
            groupId={groupId}
            group={group}
            configs={configs}
            onConfigChange={handleConfigChange}
            onBatchUpdate={handleBatchUpdate}
            isUpdating={updateConfig.isPending}
          />
        ))}
      </div>

      {updateConfig.error && (
        <div className="config-update-error">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>Update failed: {updateConfig.error.message}</span>
        </div>
      )}
    </div>
  )
}