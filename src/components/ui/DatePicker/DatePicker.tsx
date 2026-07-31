import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import './DatePicker.css'

export interface DatePickerProps {
  value?: string
  onChange?: (iso: string) => void
  min?: string
  size?: 'sm' | 'md' | 'lg'
  busyDates?: string[]
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parseia uma data ISO local (sem shift de timezone), rejeitando datas impossíveis via roundtrip. */
export function parseIsoLocal(value: string): Date | null {
  const match = ISO_DATE_RE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/** Formata uma data local como ISO (yyyy-mm-dd) com zero-pad manual, sem depender do fuso UTC. */
export function formatIsoLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstEnabledDayInMonth(year: number, month: number, min: Date): number | null {
  const total = daysInMonth(year, month)
  for (let day = 1; day <= total; day++) {
    if (new Date(year, month, day).getTime() >= min.getTime()) return day
  }
  return null
}

function computeFocusForView(
  year: number,
  month: number,
  selected: Date | null,
  min: Date,
): number | null {
  const today = startOfDay(new Date())
  if (
    selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getTime() >= min.getTime()
  ) {
    return selected.getDate()
  }
  if (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getTime() >= min.getTime()
  ) {
    return today.getDate()
  }
  return firstEnabledDayInMonth(year, month, min)
}

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const MONTH_ONLY_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
})

/** Rótulo visível do cabeçalho, ex. "Agosto 2026" (Figma node 47:7) — mês
 * capitalizado sem o conector "de" que o Intl "long" normalmente inclui. */
function formatHeaderLabel(date: Date): string {
  const month = MONTH_ONLY_FORMATTER.format(date)
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`
}

const WEEKDAY_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

export function DatePicker({ value, onChange, min, size = 'md', busyDates = [] }: DatePickerProps) {
  const selected = value ? parseIsoLocal(value) : null
  const effectiveMin = startOfDay(parseIsoLocal(min ?? '') ?? new Date())

  const [view, setView] = useState(() => {
    const base = selected ?? new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const [focusedDay, setFocusedDay] = useState<number | null>(() =>
    computeFocusForView(view.year, view.month, selected, effectiveMin),
  )

  const dayRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const pendingFocusRef = useRef(false)

  useEffect(() => {
    if (pendingFocusRef.current && focusedDay !== null) {
      dayRefs.current[focusedDay]?.focus()
      pendingFocusRef.current = false
    }
  }, [view.year, view.month, focusedDay])

  function goToMonth(year: number, month: number) {
    setView({ year, month })
    setFocusedDay(computeFocusForView(year, month, selected, effectiveMin))
  }

  function handlePrevMonth() {
    const target = new Date(view.year, view.month - 1, 1)
    goToMonth(target.getFullYear(), target.getMonth())
  }

  function handleNextMonth() {
    const target = new Date(view.year, view.month + 1, 1)
    goToMonth(target.getFullYear(), target.getMonth())
  }

  function applyFocusDate(rawDate: Date) {
    const clamped = rawDate.getTime() < effectiveMin.getTime() ? effectiveMin : rawDate
    pendingFocusRef.current = true
    setView({ year: clamped.getFullYear(), month: clamped.getMonth() })
    setFocusedDay(clamped.getDate())
  }

  function moveFocusByDays(deltaDays: number) {
    if (focusedDay === null) return
    applyFocusDate(addDays(new Date(view.year, view.month, focusedDay), deltaDays))
  }

  function moveFocusToMonthStart() {
    if (focusedDay === null) return
    applyFocusDate(new Date(view.year, view.month, 1))
  }

  function moveFocusToMonthEnd() {
    if (focusedDay === null) return
    applyFocusDate(new Date(view.year, view.month, daysInMonth(view.year, view.month)))
  }

  function selectDay(day: number) {
    const date = new Date(view.year, view.month, day)
    setFocusedDay(day)
    onChange?.(formatIsoLocal(date))
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, day: number) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        moveFocusByDays(1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        moveFocusByDays(-1)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveFocusByDays(7)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocusByDays(-7)
        break
      case 'Home':
        event.preventDefault()
        moveFocusToMonthStart()
        break
      case 'End':
        event.preventDefault()
        moveFocusToMonthEnd()
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectDay(day)
        break
      default:
        break
    }
  }

  function isBusy(date: Date): boolean {
    return busyDates.some((entry) => {
      const parsed = parseIsoLocal(entry)
      return parsed !== null && parsed.getTime() === date.getTime()
    })
  }

  const totalDays = daysInMonth(view.year, view.month)
  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const todayDate = startOfDay(new Date())
  const prevMonthDate = new Date(view.year, view.month - 1, 1)
  const nextMonthDate = new Date(view.year, view.month + 1, 1)

  return (
    <div className={`date-picker date-picker--${size}`}>
      <div className="date-picker__header">
        <button
          type="button"
          className="date-picker__nav"
          aria-label={`Mês anterior: ${MONTH_YEAR_FORMATTER.format(prevMonthDate)}`}
          onClick={handlePrevMonth}
        >
          ‹
        </button>
        <span className="date-picker__month-label">
          {formatHeaderLabel(new Date(view.year, view.month, 1))}
        </span>
        <button
          type="button"
          className="date-picker__nav"
          aria-label={`Próximo mês: ${MONTH_YEAR_FORMATTER.format(nextMonthDate)}`}
          onClick={handleNextMonth}
        >
          ›
        </button>
      </div>
      <div className="date-picker__weekdays">
        {WEEKDAY_FULL.map((fullName) => (
          <span key={fullName} className="date-picker__weekday">
            <span aria-hidden="true">{fullName.charAt(0)}</span>
            <span className="date-picker__sr-only">{fullName}</span>
          </span>
        ))}
      </div>
      <div className="date-picker__grid">
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span
            key={`blank-${index}`}
            className="date-picker__cell date-picker__cell--blank"
            aria-hidden="true"
          />
        ))}
        {Array.from({ length: totalDays }, (_, index) => {
          const day = index + 1
          const date = new Date(view.year, view.month, day)
          const isDisabled = date.getTime() < effectiveMin.getTime()
          const isSelected = selected !== null && selected.getTime() === date.getTime()
          const isToday = date.getTime() === todayDate.getTime()
          const busy = isBusy(date)
          const isFocusTarget = focusedDay === day

          let label = FULL_DATE_FORMATTER.format(date)
          if (busy) label += ', ocupado'

          const className = [
            'date-picker__day',
            isSelected && 'date-picker__day--selected',
            isToday && !isSelected && 'date-picker__day--today',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={day}
              ref={(el) => {
                dayRefs.current[day] = el
              }}
              type="button"
              className={className}
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={label}
              tabIndex={isFocusTarget ? 0 : -1}
              onClick={() => selectDay(day)}
              onKeyDown={(event) => handleDayKeyDown(event, day)}
            >
              {day}
              {busy ? <span className="date-picker__busy-dot" aria-hidden="true" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
