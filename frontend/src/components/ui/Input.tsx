import { InputHTMLAttributes } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string
  error?: string
  className?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}
      <input
        {...props}
        className={`input ${error ? 'error' : ''}`}
      />
      {error && (
        <p className="error-message">{error}</p>
      )}
    </div>
  )
} 