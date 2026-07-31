import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import chevronDownIcon from './icons/chevron-down.svg'
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
  /** Which of the three Figma "TimePicker Layouts" to render. Only applies when variant === 'grid' (default). */
  layout?: 'grid' | 'grouped' | 'list'
  /** Times with few remaining spots — rendered as the "Few" slot state (warning tone), still selectable. */
  few?: string[]
  /** Optional price label per time (e.g. `{ '07:30': 'R$ 120' }`), shown when present. */
  prices?: Record<string, string>
  /** Overrides for the Manhã/Tarde/Noite cutoffs used by layout="grouped"/"list", in minutes from midnight. */
  periodBoundaries?: {
    morningEnd?: number
    afternoonEnd?: number
  }
  /** aria-label for the day's radiogroup, used by layout="grouped"/"list". */
  ariaLabel?: string
  /** Text shown on a "Few" slot, in addition to color. */
  fewLabel?: string
  /** Text shown on an "Unavailable" (busy) slot, in addition to color/strikethrough. */
  unavailableLabel?: string
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

type SlotState = 'available' | 'selected' | 'few' | 'unavailable'

function resolveSlotState(
  minutes: number,
  selectedMinutes: number | null,
  isBusy: boolean,
  isFew: boolean,
): SlotState {
  if (isBusy) return 'unavailable'
  if (selectedMinutes === minutes) return 'selected'
  if (isFew) return 'few'
  return 'available'
}

const DEFAULT_MORNING_END = 12 * 60
const DEFAULT_AFTERNOON_END = 18 * 60

function periodLabelFor(
  minutes: number,
  boundaries?: { morningEnd?: number; afternoonEnd?: number },
): string {
  const morningEnd = boundaries?.morningEnd ?? DEFAULT_MORNING_END
  const afternoonEnd = boundaries?.afternoonEnd ?? DEFAULT_AFTERNOON_END
  if (minutes < morningEnd) return 'Manhã'
  if (minutes < afternoonEnd) return 'Tarde'
  return 'Noite'
}

const PERIOD_ORDER = ['Manhã', 'Tarde', 'Noite']

function groupSlotsByPeriod(
  slots: number[],
  boundaries?: { morningEnd?: number; afternoonEnd?: number },
): Array<{ period: string; slots: number[] }> {
  const byPeriod = new Map<string, number[]>()
  for (const minutes of slots) {
    const period = periodLabelFor(minutes, boundaries)
    const bucket = byPeriod.get(period) ?? []
    bucket.push(minutes)
    byPeriod.set(period, bucket)
  }
  return PERIOD_ORDER.filter((period) => byPeriod.has(period)).map((period) => ({
    period,
    slots: byPeriod.get(period)!,
  }))
}

function periodCountLabel(count: number): string {
  return `${count} horário${count === 1 ? '' : 's'}`
}

function slotAriaLabel(label: string, note: string | undefined, price: string | undefined): string {
  return [label, note, price].filter(Boolean).join(', ')
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

/** Roving-tabindex focus management shared by the Row-based layouts (Grouped/List). */
function useRovingFocus(length: number, initialIndex: number) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocusRef = useRef(false)
  const [focusedIndex, setFocusedIndexState] = useState(initialIndex)

  useEffect(() => {
    if (pendingFocusRef.current) {
      refs.current[focusedIndex]?.focus()
      pendingFocusRef.current = false
    }
  }, [focusedIndex])

  function moveFocus(target: number) {
    if (length === 0) return
    const clamped = Math.max(0, Math.min(length - 1, target))
    if (clamped === focusedIndex) return
    pendingFocusRef.current = true
    setFocusedIndexState(clamped)
  }

  function setFocusedIndex(index: number) {
    setFocusedIndexState(index)
  }

  return { refs, focusedIndex, moveFocus, setFocusedIndex }
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
  layout = 'grid',
  few = [],
  prices,
  periodBoundaries,
  ariaLabel = 'Horários disponíveis',
  fewLabel = 'Poucas vagas',
  unavailableLabel = 'Indisponível',
}: TimePickerProps) {
  const startMinutes = parseTime(start ?? '') ?? parseTime('07:00')!
  const endMinutes = parseTime(end ?? '') ?? parseTime('23:00')!
  const effectiveStep = Number.isInteger(step) && step! > 0 ? step! : 30

  const slots = generateSlots(startMinutes, endMinutes, effectiveStep)
  const selectedMinutes = value ? parseTime(value) : null

  function isBusyMinutes(minutes: number): boolean {
    return busy.some((entry) => parseTime(entry) === minutes)
  }

  function isFewMinutes(minutes: number): boolean {
    return few.some((entry) => parseTime(entry) === minutes)
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

  if (layout === 'grouped') {
    return (
      <GroupedTimePicker
        slots={slots}
        selectedMinutes={selectedMinutes}
        isBusyMinutes={isBusyMinutes}
        isFewMinutes={isFewMinutes}
        prices={prices}
        fewLabel={fewLabel}
        unavailableLabel={unavailableLabel}
        ariaLabel={ariaLabel}
        periodBoundaries={periodBoundaries}
        onChange={onChange}
      />
    )
  }

  if (layout === 'list') {
    return (
      <ListTimePicker
        slots={slots}
        selectedMinutes={selectedMinutes}
        isBusyMinutes={isBusyMinutes}
        isFewMinutes={isFewMinutes}
        prices={prices}
        fewLabel={fewLabel}
        unavailableLabel={unavailableLabel}
        ariaLabel={ariaLabel}
        periodBoundaries={periodBoundaries}
        onChange={onChange}
      />
    )
  }

  const hasExplicitColumns = columns !== undefined
  const effectiveColumns = Number.isInteger(columns) && columns! > 0 ? columns! : 4

  return (
    <GridTimePicker
      slots={slots}
      selectedMinutes={selectedMinutes}
      isBusyMinutes={isBusyMinutes}
      isFewMinutes={isFewMinutes}
      prices={prices}
      fewLabel={fewLabel}
      unavailableLabel={unavailableLabel}
      columns={effectiveColumns}
      hasExplicitColumns={hasExplicitColumns}
      onChange={onChange}
    />
  )
}

interface GridTimePickerProps {
  slots: number[]
  selectedMinutes: number | null
  isBusyMinutes: (minutes: number) => boolean
  isFewMinutes: (minutes: number) => boolean
  prices?: Record<string, string>
  fewLabel: string
  unavailableLabel: string
  columns: number
  hasExplicitColumns: boolean
  onChange?: (time: string) => void
}

function GridTimePicker({
  slots,
  selectedMinutes,
  isBusyMinutes,
  isFewMinutes,
  prices,
  fewLabel,
  unavailableLabel,
  columns,
  hasExplicitColumns,
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
        className={`time-picker__grid${hasExplicitColumns ? ' time-picker__grid--fixed-columns' : ''}`}
        style={
          hasExplicitColumns
            ? ({ '--time-picker-columns': String(columns) } as CSSProperties)
            : undefined
        }
      >
        {slots.map((minutes, index) => {
          const label = formatTime(minutes)
          const busySlot = isBusyMinutes(minutes)
          const state = resolveSlotState(minutes, selectedMinutes, busySlot, isFewMinutes(minutes))
          const price = prices?.[label]
          const note = state === 'few' ? fewLabel : state === 'unavailable' ? unavailableLabel : undefined
          return (
            <button
              key={minutes}
              ref={(el) => {
                buttonRefs.current[index] = el
              }}
              type="button"
              className={`time-picker__slot time-picker__slot--${state}`}
              disabled={busySlot}
              aria-pressed={state === 'selected'}
              aria-label={slotAriaLabel(label, note, price)}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => selectSlot(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="time-picker__slot-time">{label}</span>
              {price && <span className="time-picker__slot-price">{price}</span>}
              {note && <span className="time-picker__slot-note">{note}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface RowSlotProps {
  minutes: number
  isFocused: boolean
  state: SlotState
  price?: string
  fewLabel: string
  unavailableLabel: string
  buttonRef: (el: HTMLButtonElement | null) => void
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

function RowSlot({
  minutes,
  isFocused,
  state,
  price,
  fewLabel,
  unavailableLabel,
  buttonRef,
  onSelect,
  onKeyDown,
}: RowSlotProps) {
  const label = formatTime(minutes)
  const note = state === 'few' ? fewLabel : state === 'unavailable' ? unavailableLabel : undefined

  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={state === 'selected'}
      aria-disabled={state === 'unavailable'}
      aria-label={slotAriaLabel(label, note, price)}
      tabIndex={isFocused ? 0 : -1}
      className={`time-picker__row time-picker__row--${state}`}
      onClick={() => {
        if (state !== 'unavailable') onSelect()
      }}
      onKeyDown={onKeyDown}
    >
      <span className="time-picker__row-time">{label}</span>
      <span className="time-picker__row-meta">
        {price && <span className="time-picker__row-price">{price}</span>}
        {note && <span className="time-picker__row-note">{note}</span>}
      </span>
    </button>
  )
}

interface RowSlotListProps {
  id?: string
  slots: number[]
  selectedMinutes: number | null
  isBusyMinutes: (minutes: number) => boolean
  isFewMinutes: (minutes: number) => boolean
  prices?: Record<string, string>
  fewLabel: string
  unavailableLabel: string
  onChange?: (time: string) => void
}

function RowSlotList({
  id,
  slots,
  selectedMinutes,
  isBusyMinutes,
  isFewMinutes,
  prices,
  fewLabel,
  unavailableLabel,
  onChange,
}: RowSlotListProps) {
  const initialSelectedIndex = selectedMinutes !== null ? slots.indexOf(selectedMinutes) : -1
  const { refs, focusedIndex, moveFocus, setFocusedIndex } = useRovingFocus(
    slots.length,
    initialSelectedIndex >= 0 ? initialSelectedIndex : 0,
  )

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(index - 1)
        break
      case 'Home':
        event.preventDefault()
        moveFocus(0)
        break
      case 'End':
        event.preventDefault()
        moveFocus(slots.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div id={id} className="time-picker__rows">
      {slots.map((minutes, index) => {
        const label = formatTime(minutes)
        const state = resolveSlotState(
          minutes,
          selectedMinutes,
          isBusyMinutes(minutes),
          isFewMinutes(minutes),
        )
        return (
          <RowSlot
            key={minutes}
            minutes={minutes}
            isFocused={focusedIndex === index}
            state={state}
            price={prices?.[label]}
            fewLabel={fewLabel}
            unavailableLabel={unavailableLabel}
            buttonRef={(el) => {
              refs.current[index] = el
            }}
            onSelect={() => {
              setFocusedIndex(index)
              onChange?.(label)
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
          />
        )
      })}
    </div>
  )
}

interface GroupedTimePickerProps {
  slots: number[]
  selectedMinutes: number | null
  isBusyMinutes: (minutes: number) => boolean
  isFewMinutes: (minutes: number) => boolean
  prices?: Record<string, string>
  fewLabel: string
  unavailableLabel: string
  ariaLabel: string
  periodBoundaries?: { morningEnd?: number; afternoonEnd?: number }
  onChange?: (time: string) => void
}

function GroupedTimePicker({
  slots,
  selectedMinutes,
  isBusyMinutes,
  isFewMinutes,
  prices,
  fewLabel,
  unavailableLabel,
  ariaLabel,
  periodBoundaries,
  onChange,
}: GroupedTimePickerProps) {
  const groups = groupSlotsByPeriod(slots, periodBoundaries)
  const selectedPeriod =
    selectedMinutes !== null ? periodLabelFor(selectedMinutes, periodBoundaries) : null

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = selectedPeriod ?? groups[0]?.period
    return new Set(initial ? [initial] : [])
  })

  function togglePeriod(period: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(period)) next.delete(period)
      else next.add(period)
      return next
    })
  }

  return (
    <div className="time-picker time-picker--grouped">
      <div className="time-picker__groups" role="radiogroup" aria-label={ariaLabel}>
        {groups.map(({ period, slots: periodSlots }) => {
          const isExpanded = expanded.has(period)
          const panelId = `time-picker-panel-${period}`
          return (
            <div className="time-picker__period" key={period}>
              <button
                type="button"
                className="time-picker__period-header"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={() => togglePeriod(period)}
              >
                <span className="time-picker__period-label">{period}</span>
                <span className="time-picker__period-meta">
                  <span className="time-picker__period-count">
                    {periodCountLabel(periodSlots.length)}
                  </span>
                  <img
                    src={chevronDownIcon}
                    alt=""
                    aria-hidden="true"
                    className={`time-picker__chevron${isExpanded ? ' time-picker__chevron--expanded' : ''}`}
                  />
                </span>
              </button>
              {isExpanded && (
                <RowSlotList
                  id={panelId}
                  slots={periodSlots}
                  selectedMinutes={selectedMinutes}
                  isBusyMinutes={isBusyMinutes}
                  isFewMinutes={isFewMinutes}
                  prices={prices}
                  fewLabel={fewLabel}
                  unavailableLabel={unavailableLabel}
                  onChange={onChange}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ListTimePickerProps {
  slots: number[]
  selectedMinutes: number | null
  isBusyMinutes: (minutes: number) => boolean
  isFewMinutes: (minutes: number) => boolean
  prices?: Record<string, string>
  fewLabel: string
  unavailableLabel: string
  ariaLabel: string
  periodBoundaries?: { morningEnd?: number; afternoonEnd?: number }
  onChange?: (time: string) => void
}

function ListTimePicker({
  slots,
  selectedMinutes,
  isBusyMinutes,
  isFewMinutes,
  prices,
  fewLabel,
  unavailableLabel,
  ariaLabel,
  periodBoundaries,
  onChange,
}: ListTimePickerProps) {
  const groups = groupSlotsByPeriod(slots, periodBoundaries)
  const initialSelectedIndex = selectedMinutes !== null ? slots.indexOf(selectedMinutes) : -1
  const { refs, focusedIndex, moveFocus, setFocusedIndex } = useRovingFocus(
    slots.length,
    initialSelectedIndex >= 0 ? initialSelectedIndex : 0,
  )

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(index - 1)
        break
      case 'Home':
        event.preventDefault()
        moveFocus(0)
        break
      case 'End':
        event.preventDefault()
        moveFocus(slots.length - 1)
        break
      default:
        break
    }
  }

  let cursor = 0

  return (
    <div className="time-picker time-picker--list">
      <div className="time-picker__rows" role="radiogroup" aria-label={ariaLabel}>
        {groups.map(({ period, slots: periodSlots }) => {
          const startIndex = cursor
          cursor += periodSlots.length
          return (
            <div className="time-picker__list-group" key={period}>
              <div
                className="time-picker__period-header time-picker__period-header--static"
                role="separator"
                aria-label={`${period}, ${periodCountLabel(periodSlots.length)}`}
              >
                <span className="time-picker__period-label">{period}</span>
                <span className="time-picker__period-count">
                  {periodCountLabel(periodSlots.length)}
                </span>
              </div>
              {periodSlots.map((minutes, i) => {
                const index = startIndex + i
                const label = formatTime(minutes)
                const state = resolveSlotState(
                  minutes,
                  selectedMinutes,
                  isBusyMinutes(minutes),
                  isFewMinutes(minutes),
                )
                return (
                  <RowSlot
                    key={minutes}
                    minutes={minutes}
                    isFocused={focusedIndex === index}
                    state={state}
                    price={prices?.[label]}
                    fewLabel={fewLabel}
                    unavailableLabel={unavailableLabel}
                    buttonRef={(el) => {
                      refs.current[index] = el
                    }}
                    onSelect={() => {
                      setFocusedIndex(index)
                      onChange?.(label)
                    }}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  />
                )
              })}
            </div>
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
