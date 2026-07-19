import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as classesApi from '../../lib/api/classes'
import type { Court } from '../../lib/api/courts'
import { NovaReservaSheet } from './NovaReservaSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

const courts: Court[] = [{ id: 'court-1', unitId: 'unit-1', name: 'Q1', sport: 'beach_tennis', status: 'active' }]

function renderSheet(onCreated = vi.fn()) {
  const onClose = vi.fn()
  const utils = render(
    <NovaReservaSheet open unitId="unit-1" courts={courts} onClose={onClose} onCreated={onCreated} />,
  )
  return { ...utils, onClose, onCreated }
}

describe('NovaReservaSheet (AG6)', () => {
  it('shows all 4 type-pills exactly as the real prototype (#ag6Types)', () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    renderSheet()

    for (const label of ['Turma', 'Particular', 'Avulsa', 'Bloqueio']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('switches fields when the Bloqueio pill is selected, with the exact hint copy', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Bloqueio' }))

    expect(screen.getByLabelText('Motivo')).toBeInTheDocument()
    expect(screen.getByLabelText('Até (data fim)')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Bloqueio não verifica nem cancela reservas existentes automaticamente — confirme que a quadra está livre no período antes de criar.',
      ),
    ).toBeInTheDocument()
  })

  it('creates an "Avulsa" booking (type=adhoc) for real via POST /units/{id}/bookings', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    const createBookingSpy = vi.spyOn(bookingsApi, 'createBooking').mockResolvedValue({
      ok: true,
      booking: {
        id: 'b1',
        courtId: 'court-1',
        courtName: 'Q1',
        type: 'adhoc',
        classId: null,
        className: null,
        startAt: '2026-07-10T18:00:00.000Z',
        endAt: '2026-07-10T19:00:00.000Z',
        status: 'confirmed',
        teacherName: null,
        studentName: null,
        responsibleName: 'Carlos',
        reason: null,
      },
    })
    const onCreated = vi.fn()
    renderSheet(onCreated)

    await userEvent.click(screen.getByRole('button', { name: 'Avulsa' }))
    await userEvent.type(screen.getByLabelText('Responsável'), 'Carlos')
    await userEvent.click(screen.getByRole('button', { name: 'Criar reserva' }))

    expect(createBookingSpy).toHaveBeenCalledWith(
      'unit-1',
      expect.objectContaining({ type: 'adhoc', courtId: 'court-1', responsibleName: 'Carlos' }),
    )
    expect(await screen.findByText(/Reserva criada/)).toBeInTheDocument()
  })

  it('shows an "unavailable" message instead of a fake call when an existing Turma is selected', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [
        {
          id: 'class-1',
          unitId: 'unit-1',
          teacherId: 't1',
          sport: 'beach_tennis',
          name: 'BT intermediária',
          courtId: 'court-1',
          rrule: 'FREQ=WEEKLY',
          startTime: '18:00',
          endTime: '19:00',
          capacity: 8,
          level: null,
          status: 'active',
        },
      ],
    })
    const createClassSpy = vi.spyOn(classesApi, 'createClass')
    renderSheet()

    expect(await screen.findByText('BT intermediária')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Turma'), 'class-1')
    await userEvent.click(screen.getByRole('button', { name: 'Criar reserva' }))

    expect(await screen.findByText(/ainda não está disponível/)).toBeInTheDocument()
    expect(createClassSpy).not.toHaveBeenCalled()
  })
})
