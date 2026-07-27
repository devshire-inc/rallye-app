import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import './TimePicker.css'

export interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  start?: string
  end?: string
  step?: number
  busy?: string[]
  variant?: 'grid' | 'wheel'
  columns?: number
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseTime(value: string): number | null {
  const match = TIME_RE.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatTime(totalMinutes: number): string {
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`
}

export function generateSlots(startMinutes: number, endMinutes: number, step: number): number[] {
  if (startMinutes > endMinutes) return []
  const slots: number[] = []
  for (let t = startMinutes; t <= endMinutes; t += step) {
    slots.push(t)
  }
  return slots
}

function findEnabledIndex(
  rawTarget: number,
  primaryDirection: 1 | -1,
  length: number,
  isBusyAt: (index: number) => boolean,
  fallback: number | null,
): number | null {
  if (length === 0) return null
  const clamped = Math.max(0, Math.min(length - 1, rawTarget))

  let scan = clamped
  while (scan >= 0 && scan < length && isBusyAt(scan)) scan += primaryDirection
  if (scan >= 0 && scan < length) return scan

  const opposite = primaryDirection === 1 ? -1 : 1
  scan = clamped
  while (scan >= 0 && scan < length && isBusyAt(scan)) scan += opposite
  if (scan >= 0 && scan < length) return scan

  return fallback
}

export function TimePicker({
  value,
  onChange,
  start,
  end,
  step,
  busy = [],
  variant = 'grid',
  columns,
}: TimePickerProps) {
  const startMinutes = parseTime(start ?? '') ?? parseTime('07:00')!
  const endMinutes = parseTime(end ?? '') ?? parseTime('23:00')!
  const effectiveStep = Number.isInteger(step) && step! > 0 ? step! : 30
  const effectiveColumns = Number.isInteger(columns) && columns! > 0 ? columns! : 4

  const slots = generateSlots(startMinutes, endMinutes, effectiveStep)
  const selectedMinutes = value ? parseTime(value) : null

  function isBusyMinutes(minutes: number): boolean {
    return busy.some((entry) => parseTime(entry) === minutes)
  }

  if (variant === 'wheel') {
    return (
      <WheelTimePicker
        slots={slots}
        selectedMinutes={selectedMinutes}
        isBusyMinutes={isBusyMinutes}
        onChange={onChange}
      />
    )
  }

  return (
    <GridTimePicker
      slots={slots}
      selectedMinutes={selectedMinutes}
      isBusyMinutes={isBusyMinutes}
      columns={effectiveColumns}
      onChange={onChange}
    />
  )
}

interface GridTimePickerProps {
  slots: number[]
  selectedMinutes: number | null
  isBusyMinutes: (minutes: number) => boolean
  columns: number
  onChange?: (time: string) => void
}

function GridTimePicker({
  slots,
  selectedMinutes,
  isBusyMinutes,
  columns,
  onChange,
}: GridTimePickerProps) {
  const isBusyAt = (index: number) => isBusyMinutes(slots[index]!)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocusRef = useRef(false)

  const initialSelectedIndex = selectedMinutes !== null ? slots.indexOf(selectedMinutes) : -1
  const [focusedIndex, setFocusedIndex] = useState<number | null>(() =>
    findEnabledIndex(
      initialSelectedIndex >= 0 ? initialSelectedIndex : 0,
      1,
      slots.length,
      isBusyAt,
      null,
    ),
  )

  useEffect(() => {
    if (pendingFocusRef.current && focusedIndex !== null) {
      buttonRefs.current[focusedIndex]?.focus()
      pendingFocusRef.current = false
    }
  }, [focusedIndex])

  function moveFocus(rawTarget: number, primaryDirection: 1 | -1) {
    const next = findEnabledIndex(rawTarget, primaryDirection, slots.length, isBusyAt, focusedIndex)
    if (next === null || next === focusedIndex) return
    pendingFocusRef.current = true
    setFocusedIndex(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        moveFocus(index + 1, 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        moveFocus(index - 1, -1)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(index + columns, 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(index - columns, -1)
        break
      case 'Home':
        event.preventDefault()
        moveFocus(0, 1)
        break
      case 'End':
        event.preventDefault()
        moveFocus(slots.length - 1, -1)
        break
      default:
        break
    }
  }

  function selectSlot(index: number) {
    setFocusedIndex(index)
    onChange?.(formatTime(slots[index]!))
  }

  return (
    <div className="time-picker time-picker--grid">
      <div
        className="time-picker__grid"
        style={{ '--time-picker-columns': String(columns) } as CSSProperties}
      >
        {slots.map((minutes, index) => {
          const label = formatTime(minutes)
          const isSelected = selectedMinutes === minutes
          const busySlot = isBusyMinutes(minutes)
          return (
            <button
              key={minutes}
              ref={(el) => {
                buttonRefs.current[index] = el
              }}
              type="button"
              className={`time-picker__slot${isSelected ? ' time-picker__slot--selected' : ''}`}
              disabled={busySlot}
              aria-pressed={isSelected}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => selectSlot(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface WheelTimePickerProps {
  slots: number[]
  selectedMinutes: number | null
  isBusyMinutes: (minutes: number) => boolean
  onChange?: (time: string) => void
}

function WheelTimePicker({
  slots,
  selectedMinutes,
  isBusyMinutes,
  onChange,
}: WheelTimePickerProps) {
  const hours = Array.from(new Set(slots.map((minutes) => Math.floor(minutes / 60)))).sort(
    (a, b) => a - b,
  )

  function minutesForHour(hour: number): number[] {
    return slots
      .filter((minutes) => Math.floor(minutes / 60) === hour)
      .map((minutes) => minutes % 60)
  }

  function isHourFullyBusy(hour: number): boolean {
    return minutesForHour(hour).every((minute) => isBusyMinutes(hour * 60 + minute))
  }

  function firstFreeMinuteForHour(hour: number): number | null {
    const minutes = minutesForHour(hour)
    return minutes.find((minute) => !isBusyMinutes(hour * 60 + minute)) ?? minutes[0] ?? null
  }

  const [selectedHour, setSelectedHour] = useState(() => {
    if (selectedMinutes !== null) return Math.floor(selectedMinutes / 60)
    return hours.find((hour) => !isHourFullyBusy(hour)) ?? hours[0] ?? 0
  })
  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (selectedMinutes !== null) return selectedMinutes % 60
    return firstFreeMinuteForHour(selectedHour) ?? 0
  })

  function handleHourChange(newHour: number) {
    const minutesList = minutesForHour(newHour)
    const currentMinuteValid =
      minutesList.includes(selectedMinute) && !isBusyMinutes(newHour * 60 + selectedMinute)
    const newMinute = currentMinuteValid
      ? selectedMinute
      : (firstFreeMinuteForHour(newHour) ?? selectedMinute)

    setSelectedHour(newHour)
    setSelectedMinute(newMinute)

    if (minutesList.includes(newMinute) && !isBusyMinutes(newHour * 60 + newMinute)) {
      onChange?.(formatTime(newHour * 60 + newMinute))
    }
  }

  function handleMinuteChange(newMinute: number) {
    setSelectedMinute(newMinute)
    if (!isBusyMinutes(selectedHour * 60 + newMinute)) {
      onChange?.(formatTime(selectedHour * 60 + newMinute))
    }
  }

  return (
    <div className="time-picker time-picker--wheel">
      <select
        aria-label="Hora"
        className="time-picker__wheel-select"
        value={pad2(selectedHour)}
        onChange={(event) => handleHourChange(Number(event.target.value))}
      >
        {hours.map((hour) => (
          <option key={hour} value={pad2(hour)} disabled={isHourFullyBusy(hour)}>
            {pad2(hour)}
          </option>
        ))}
      </select>
      <select
        aria-label="Minuto"
        className="time-picker__wheel-select"
        value={pad2(selectedMinute)}
        onChange={(event) => handleMinuteChange(Number(event.target.value))}
      >
        {minutesForHour(selectedHour).map((minute) => (
          <option
            key={minute}
            value={pad2(minute)}
            disabled={isBusyMinutes(selectedHour * 60 + minute)}
          >
            {pad2(minute)}
          </option>
        ))}
      </select>
    </div>
  )
}
