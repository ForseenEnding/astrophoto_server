import { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string
  error?: string
  className?: string
  children: ReactNode
}

export function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}
      <select
        {...props}
        className={`select ${error ? 'error' : ''}`}
      >
        {children}
      </select>
      {error && (
        <p className="error-message">{error}</p>
      )}
    </div>
  )
} 