import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import type { AccessibleLabel } from '../accessibility'
import './Select.css'

export type SelectProps = AccessibleLabel & {
  options?: Array<string | { value: string; label: string }>
  placeholder?: string
  id?: string
  disabled?: boolean
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'disabled'>

export function Select({
  label,
  ariaLabel,
  options = [],
  placeholder,
  id,
  disabled,
  ...nativeProps
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className="select">
      {label ? <label htmlFor={selectId}>{label}</label> : null}
      <select
        id={selectId}
        className="select__control"
        disabled={disabled}
        aria-label={ariaLabel}
        {...nativeProps}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value
          const optionLabel = typeof option === 'string' ? option : option.label
          return (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          )
        })}
      </select>
    </div>
  )
}
