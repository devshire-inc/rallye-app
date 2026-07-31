import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import type { AccessibleLabel } from '../accessibility'
import chevronDownIcon from './icons/chevron-down.svg'
import './Select.css'

export type SelectProps = AccessibleLabel & {
  options?: Array<string | { value: string; label: string }>
  placeholder?: string
  id?: string
  disabled?: boolean
  error?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'disabled'>

export function Select({
  label,
  ariaLabel,
  options = [],
  placeholder,
  id,
  disabled,
  error,
  ...nativeProps
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className="select">
      {label ? <label htmlFor={selectId}>{label}</label> : null}
      <div className={error ? 'select__field select__field--error' : 'select__field'}>
        <select
          id={selectId}
          className="select__control"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
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
        <img src={chevronDownIcon} alt="" className="select__chevron" aria-hidden="true" />
      </div>
      {error ? <span className="select__error">{error}</span> : null}
    </div>
  )
}
