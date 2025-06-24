import { AlertCircle, Save, X } from 'lucide-react';
import { useState } from 'react';

interface CreatePresetFormProps {
  onSave: (data: { name: string; label: string; description?: string }) => void
  onCancel: () => void
  isLoading: boolean
  error: Error | null
}

export function CreatePresetForm({ onSave, onCancel, isLoading, error }: CreatePresetFormProps) {
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
    <div className="preset-form-overlay">
      <div className="preset-form-modal">
        <div className="preset-form-header">
          <h3>Save Current Camera Settings</h3>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="btn-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="preset-form">
          <div className="form-group">
            <label htmlFor="preset-label">Preset Name *</label>
            <input
              id="preset-label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              placeholder="e.g., Deep Sky Default"
              className="input"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="preset-name">Technical Name (optional)</label>
            <input
              id="preset-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Auto-generated from preset name"
              className="input"
              disabled={isLoading}
              pattern="[a-zA-Z0-9_-]+"
              title="Only letters, numbers, underscores, and hyphens allowed"
            />
            <p className="form-help">
              Used for file storage. Auto-generated if left empty.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="preset-description">Description (optional)</label>
            <textarea
              id="preset-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe when to use this preset..."
              className="input preset-textarea"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="preset-form-error">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>{error.message}</span>
            </div>
          )}

          <div className="preset-form-actions">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isLoading || !formData.label.trim()}
              className="btn btn-primary"
            >
              {isLoading ? (
                <>
                  <div className="btn-spinner" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preset
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}