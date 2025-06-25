import { AlertCircle, Loader2, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { useApplyPreset, useCameraPresets, useDeletePreset, useSavePreset } from '../../hooks/useCameraPresets'
import { Button } from '../ui/Button'
import { PresetCard } from './PresetCard'
import { PresetForm } from './PresetForm'

export function PresetManager() {
  const { data, isLoading, error } = useCameraPresets()
  const savePreset = useSavePreset()
  const applyPreset = useApplyPreset()
  const deletePreset = useDeletePreset()
  
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleSavePreset = (presetData: { name: string; label: string; description?: string }) => {
    savePreset.mutate(presetData, {
      onSuccess: () => {
        setShowCreateForm(false)
      }
    })
  }

  const handleApplyPreset = (name: string) => {
    applyPreset.mutate(name)
  }

  const handleDeletePreset = (name: string) => {
    if (window.confirm('Are you sure you want to delete this preset? This action cannot be undone.')) {
      deletePreset.mutate(name)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mr-3" />
        <p className="text-gray-600">Loading presets...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
        <div>
          <p className="text-red-600 font-medium">Failed to load presets</p>
          <p className="text-sm text-gray-500 mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  const presets = data?.presets || []

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Camera Presets
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Save and restore camera configuration settings
          </p>
        </div>
        
        <Button
          onClick={() => setShowCreateForm(true)}
          disabled={savePreset.isPending}
        >
          <Plus className="w-4 h-4 mr-2" />
          Save Current Settings
        </Button>
      </div>

      {/* Create Preset Form */}
      {showCreateForm && (
        <PresetForm
          onSave={handleSavePreset}
          onCancel={() => setShowCreateForm(false)}
          isLoading={savePreset.isPending}
          error={savePreset.error?.message}
        />
      )}

      {/* Error Messages */}
      {applyPreset.error && (
        <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
          <span className="text-red-700 dark:text-red-300 text-sm">
            Apply failed: {applyPreset.error.message}
          </span>
        </div>
      )}

      {deletePreset.error && (
        <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
          <span className="text-red-700 dark:text-red-300 text-sm">
            Delete failed: {deletePreset.error.message}
          </span>
        </div>
      )}

      {/* Presets List */}
      {presets.length === 0 ? (
        <div className="text-center py-12">
          <Save className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            No presets saved yet
          </p>
          <p className="text-sm text-gray-500">
            Click "Save Current Settings" to create your first preset
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <PresetCard
              key={preset.name}
              preset={preset}
              onApply={() => handleApplyPreset(preset.name)}
              onDelete={() => handleDeletePreset(preset.name)}
              isApplying={applyPreset.isPending && applyPreset.variables === preset.name}
              isDeleting={deletePreset.isPending && deletePreset.variables === preset.name}
            />
          ))}
        </div>
      )}
    </div>
  )
} 