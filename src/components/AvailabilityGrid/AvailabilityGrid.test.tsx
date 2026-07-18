import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { patchAvailabilityMock } = vi.hoisted(() => ({
  patchAvailabilityMock: vi.fn(),
}))

vi.mock('../../lib/api/availability', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/availability')>(
    '../../lib/api/availability',
  )
  return { ...actual, patchAvailability: patchAvailabilityMock }
})

import { AvailabilityGrid } from './AvailabilityGrid'
import type { AvailabilityGridReadCell } from './AvailabilityGrid'
import type { AvailabilitySlot } from '../../lib/api/availability'

describe('AvailabilityGrid — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeSlots(): AvailabilitySlot[] {
    return [
      { dayOfWeek: 1, timeSlot: '08-10', available: true },
      { dayOfWeek: 1, timeSlot: '10-12', available: false },
    ]
  }

  it('renders a toggle cell per slot reflecting the current available state', () => {
    render(<AvailabilityGrid mode="edit" teacherId="teacher-1" slots={makeSlots()} />)

    const availableCell = screen.getByRole('button', { name: /segunda.*08-10/i })
    const unavailableCell = screen.getByRole('button', { name: /segunda.*10-12/i })

    expect(availableCell).toHaveAttribute('aria-pressed', 'true')
    expect(unavailableCell).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles a cell and saves via PATCH with the flipped value', async () => {
    patchAvailabilityMock.mockResolvedValue({
      ok: true,
      availability: [{ dayOfWeek: 1, timeSlot: '10-12', available: true }],
    })
    const user = userEvent.setup()

    render(<AvailabilityGrid mode="edit" teacherId="teacher-1" slots={makeSlots()} />)

    const cell = screen.getByRole('button', { name: /segunda.*10-12/i })
    await user.click(cell)

    expect(patchAvailabilityMock).toHaveBeenCalledWith('teacher-1', [
      { dayOfWeek: 1, timeSlot: '10-12', available: true },
    ])
    expect(cell).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggle with the updated slot after a successful save', async () => {
    patchAvailabilityMock.mockResolvedValue({
      ok: true,
      availability: [{ dayOfWeek: 1, timeSlot: '08-10', available: false }],
    })
    const onToggle = vi.fn()
    const user = userEvent.setup()

    render(
      <AvailabilityGrid
        mode="edit"
        teacherId="teacher-1"
        slots={makeSlots()}
        onToggle={onToggle}
      />,
    )

    await user.click(screen.getByRole('button', { name: /segunda.*08-10/i }))

    expect(onToggle).toHaveBeenCalledWith({ dayOfWeek: 1, timeSlot: '08-10', available: false })
  })

  it('reverts the optimistic toggle when the save fails', async () => {
    patchAvailabilityMock.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' })
    const user = userEvent.setup()

    render(<AvailabilityGrid mode="edit" teacherId="teacher-1" slots={makeSlots()} />)

    const cell = screen.getByRole('button', { name: /segunda.*08-10/i })
    expect(cell).toHaveAttribute('aria-pressed', 'true')

    await user.click(cell)

    expect(cell).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('AvailabilityGrid — read mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeCells(): AvailabilityGridReadCell[] {
    return [
      { dayOfWeek: 1, timeSlot: '08-10', status: 'available' },
      { dayOfWeek: 1, timeSlot: '10-12', status: 'busy' },
      { dayOfWeek: 2, timeSlot: '08-10', status: 'unavailable' },
    ]
  }

  it('renders the 3 visual states without calling any API', () => {
    render(<AvailabilityGrid mode="read" cells={makeCells()} />)

    expect(screen.getByTestId('availability-cell-1-08-10')).toHaveAttribute(
      'data-status',
      'available',
    )
    expect(screen.getByTestId('availability-cell-1-10-12')).toHaveAttribute('data-status', 'busy')
    expect(screen.getByTestId('availability-cell-2-08-10')).toHaveAttribute(
      'data-status',
      'unavailable',
    )
    expect(patchAvailabilityMock).not.toHaveBeenCalled()
  })

  it('renders the 3-state legend matching the PR2 doc', () => {
    render(<AvailabilityGrid mode="read" cells={makeCells()} />)

    expect(screen.getByText('Disponível')).toBeInTheDocument()
    expect(screen.getByText('Ocupado com aula')).toBeInTheDocument()
    expect(screen.getByText('Indisponível')).toBeInTheDocument()
  })

  it('renders the fixed hint text', () => {
    render(<AvailabilityGrid mode="read" cells={makeCells()} />)

    expect(
      screen.getByText(
        'Editável pelo admin e pelo próprio professor. Usada como referência ao agendar (AG6 alerta conflito).',
      ),
    ).toBeInTheDocument()
  })

  it('treats any combination missing from `cells` as unavailable', () => {
    render(<AvailabilityGrid mode="read" cells={[]} />)

    expect(screen.getByTestId('availability-cell-1-08-10')).toHaveAttribute(
      'data-status',
      'unavailable',
    )
  })
})
