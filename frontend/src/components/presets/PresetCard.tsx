import { Clock, Play, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface Preset {
  name: string
  label: string
  description?: string
  created_at?: string
}

interface PresetCardProps {
  preset: Preset
  onApply: () => void
  onDelete: () => void
  isApplying?: boolean
  isDeleting?: boolean
}

export function PresetCard({ 
  preset, 
  onApply, 
  onDelete, 
  isApplying = false,
  isDeleting = false 
}: PresetCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              {preset.label}
            </h4>
            {preset.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {preset.description}
              </p>
            )}
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              {preset.created_at ? new Date(preset.created_at).toLocaleDateString() : 'Unknown date'}
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={onApply}
            disabled={isApplying || isDeleting}
            loading={isApplying}
            size="sm"
            className="flex-1"
          >
            <Play className="w-3 h-3 mr-1" />
            Apply
          </Button>
          
          <Button
            onClick={onDelete}
            disabled={isApplying || isDeleting}
            loading={isDeleting}
            variant="danger"
            size="sm"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  )
} 