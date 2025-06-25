import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  title?: string
  className?: string
  headerActions?: ReactNode
}

export function Card({ children, title, className = '', headerActions }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || headerActions) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {headerActions && <div className="card-actions">{headerActions}</div>}
        </div>
      )}
      <div className="card-content">{children}</div>
    </div>
  )
} 