import { Save, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'

interface PresetFormProps {
  onSave: (data: { name: string; label: string; description?: string }) => void
  onCancel: () => void
  isLoading: boolean
  error?: string
}

export function PresetForm({ onSave, onCancel, isLoading, error }: PresetFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.label.trim()) return

    // Generate name from label if not provided
    const name = formData.name.trim() || 
      formData.label.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '_')          // Replace spaces with underscores
        .substring(0, 50)              // Limit length

    onSave({
      name,
      label: formData.label.trim(),
      description: formData.description.trim() || undefined
    })
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Save Current Camera Settings
        </h3>
        <Button
          onClick={onCancel}
          disabled={isLoading}
          variant="secondary"
          size="sm"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Preset Name *"
          value={formData.label}
          onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
          placeholder="e.g., Deep Sky Default"
          required
          disabled={isLoading}
        />

        <Input
          label="Technical Name (optional)"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Auto-generated from preset name"
          disabled={isLoading}
          pattern="[a-zA-Z0-9_-]+"
          title="Only letters, numbers, underscores, and hyphens allowed"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe when to use this preset..."
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows={3}
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            variant="secondary"
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            disabled={isLoading || !formData.label.trim()}
            loading={isLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Preset
          </Button>
        </div>
      </form>
    </Card>
  )
} 