import { ReactNode } from 'react'
import { Button } from '../ui/Button'

interface ConfigTabProps {
  id: string
  label: string
  icon: ReactNode
  isActive: boolean
  onClick: () => void
}

export function ConfigTab({ id, label, icon, isActive, onClick }: ConfigTabProps) {
  return (
    <Button
      onClick={onClick}
      variant={isActive ? 'primary' : 'secondary'}
      size="sm"
      className="flex items-center"
    >
      {icon}
      <span className="ml-2">{label}</span>
    </Button>
  )
} 