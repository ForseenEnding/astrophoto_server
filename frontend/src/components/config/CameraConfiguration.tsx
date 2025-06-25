import { AlertCircle, Loader2, Save, Settings } from 'lucide-react'
import { useState } from 'react'
import { useCameraConfigGroups, useUpdateCameraConfig } from '../../hooks/useCameraConfig'
import { PresetManager } from '../presets/PresetManager'
import { ConfigSection } from './ConfigSection'
import { ConfigTab } from './ConfigTab'

type ConfigTabType = 'config' | 'presets'

export function CameraConfiguration() {
  const [activeTab, setActiveTab] = useState<ConfigTabType>('config')
  const { data, isLoading, error } = useCameraConfigGroups()
  const updateConfig = useUpdateCameraConfig()

  const handleBatchUpdate = (changes: Record<string, string>) => {
    updateConfig.mutate({
      configs: changes
    })
  }

  const renderConfigTab = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mr-3" />
          <p className="text-gray-600">Loading camera configuration...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12">
          <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
          <div>
            <p className="text-red-600 font-medium">Failed to load camera configuration</p>
            <p className="text-sm text-gray-500 mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      )
    }

    if (!data) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No configuration data available</p>
        </div>
      )
    }

    const { groups, configs } = data

    return (
      <div className="space-y-4">
        {Object.entries(groups).map(([groupId, group]) => (
          <ConfigSection
            key={groupId}
            groupId={groupId}
            group={group}
            configs={configs}
            onBatchUpdate={handleBatchUpdate}
            isUpdating={updateConfig.isPending}
          />
        ))}

        {updateConfig.error && (
          <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">
              Update failed: {updateConfig.error.message}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Settings className="w-6 h-6 mr-2" />
          Camera Configuration
        </h2>
        
        <div className="flex space-x-2">
          <ConfigTab
            id="config"
            label="Settings"
            icon={<Settings className="w-4 h-4" />}
            isActive={activeTab === 'config'}
            onClick={() => setActiveTab('config')}
          />
          <ConfigTab
            id="presets"
            label="Presets"
            icon={<Save className="w-4 h-4" />}
            isActive={activeTab === 'presets'}
            onClick={() => setActiveTab('presets')}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === 'config' ? renderConfigTab() : <PresetManager />}
      </div>
    </div>
  )
} 