import { useEffect, useRef } from 'react'
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react'
import './OtpInput.css'

export type OtpInputProps = {
  /** Number of digit boxes. Defaults to 6 (BEAC-1676's A4 code length). */
  length?: number
  /** Current code, as a plain digit string (e.g. "123" while still typing). */
  value: string
  /** Called with the full digit string every time it changes. */
  onChange: (value: string) => void
  /** Called once when the code reaches `length` digits. */
  onComplete?: (value: string) => void
  /** Triggers a shake animation and error styling (e.g. wrong code). */
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Reusable 6-digit OTP input: one box per digit, auto-advance on entry,
 * backspace to go back, numeric keyboard on mobile, paste support. Built for
 * BEAC-1676's tela A4 (verificação de e-mail) but intentionally generic so
 * other verification screens (A3/A5, in other stories) can reuse it.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus()
    }
    // Only run on mount — refocusing on every value change would fight the
    // user's own navigation between boxes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const digits = Array.from({ length }, (_, i) => value[i] ?? '')
  const filledCount = digits.filter((d) => d !== '').length
  const progressMessage =
    filledCount === length ? 'Código completo' : `Dígito ${filledCount} de ${length} preenchido`

  function setDigitAt(index: number, digit: string) {
    const next = digits.slice()
    next[index] = digit
    const nextValue = next.join('').slice(0, length)
    onChange(nextValue)
    if (nextValue.length === length) {
      onComplete?.(nextValue)
    }
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') {
      setDigitAt(index, '')
      return
    }
    // Only the last typed digit matters for this box; move focus forward.
    const digit = raw[raw.length - 1]
    setDigitAt(index, digit)
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
      setDigitAt(index - 1, '')
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handlePaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '')
    if (!pasted) return
    e.preventDefault()
    const next = digits.slice()
    for (let i = 0; i < pasted.length && index + i < length; i++) {
      next[index + i] = pasted[i]
    }
    const nextValue = next.join('').slice(0, length)
    onChange(nextValue)
    const lastFilled = Math.min(index + pasted.length, length) - 1
    inputRefs.current[Math.max(lastFilled, 0)]?.focus()
    if (nextValue.length === length) {
      onComplete?.(nextValue)
    }
  }

  return (
    <div
      className={`otp-input${error ? ' otp-input--error' : ''}`}
      role="group"
      aria-label="Código de verificação"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={1}
          className="otp-input__box"
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          aria-label={`Dígito ${index + 1} de ${length}`}
        />
      ))}
      <span role="status" aria-live="polite" className="otp-input__sr-only">
        {progressMessage}
      </span>
    </div>
  )
}
