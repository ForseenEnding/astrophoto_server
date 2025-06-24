import { useApplyPreset, useCameraPresets, useDeletePreset, useSavePreset } from '@/hooks/useCameraPresets'
import { AlertCircle, Loader2, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { CreatePresetForm } from './CreatePresetForm'
import { PresetCard } from './PresetCard'

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
      <div className="preset-loading">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <p>Loading presets...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="preset-error">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p>Failed to load presets</p>
        <p className="text-sm text-gray-500">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  const presets = data?.presets || []

  return (
    <div className="preset-manager">
      {/* Header with Actions */}
      <div className="preset-header">
        <div className="preset-title">
          <h3>Camera Presets</h3>
          <p className="preset-subtitle">
            Save and restore camera configuration settings
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateForm(true)}
          disabled={savePreset.isPending}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Save Current Settings
        </button>
      </div>

      {/* Create Preset Form */}
      {showCreateForm && (
        <CreatePresetForm
          onSave={handleSavePreset}
          onCancel={() => setShowCreateForm(false)}
          isLoading={savePreset.isPending}
          error={savePreset.error}
        />
      )}

      {/* Error Messages */}
      {applyPreset.error && (
        <div className="preset-error-message">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>Apply failed: {applyPreset.error.message}</span>
        </div>
      )}

      {deletePreset.error && (
        <div className="preset-error-message">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>Delete failed: {deletePreset.error.message}</span>
        </div>
      )}

      {/* Presets List */}
      <div className="preset-list">
        {presets.length === 0 ? (
          <div className="preset-empty">
            <Save className="w-12 h-12 text-gray-400" />
            <p className="text-lg text-gray-600">No presets saved yet</p>
            <p className="text-sm text-gray-500">
              Click "Save Current Settings" to create your first preset
            </p>
          </div>
        ) : (
          <div className="preset-grid">
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
    </div>
  )
}