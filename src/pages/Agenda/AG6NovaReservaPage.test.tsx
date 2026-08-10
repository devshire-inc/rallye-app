import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as classesApi from '../../lib/api/classes'
import * as courtsApi from '../../lib/api/courts'
import type { Court } from '../../lib/api/courts'
import AG6NovaReservaPage from './AG6NovaReservaPage'

/**
 * Migrado de `NovaReservaSheet.test.tsx` quando AG6 deixou de ser um bottom
 * sheet e virou página (ver o comentário de módulo do componente). Os quatro
 * casos do sheet continuam aqui, um a um, com a MESMA intenção — o que mudou
 * foi só como a tela é montada (rota + query params, em vez de props `open`/
 * `courts`/`prefill`) e o desfecho do sucesso (volta para a origem, em vez de
 * `onClose`). Nenhum foi apagado.
 *
 * Os casos novos (do 5º em diante) cobrem justamente o que a conversão
 * introduziu e o sheet não tinha como ter: preenchimento pela URL e a volta
 * para a origem certa nos dois caminhos.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

const courts: Court[] = [{ id: 'court-1', unitId: 'unit-1', name: 'Q1', sport: 'beach_tennis', status: 'active' }]

/** Renderiza a rota real e expõe onde a navegação parou — é assim que se
 * observa "a volta" agora que ela é navegação, e não uma prop `onClose`. */
function renderPage(search = '') {
  const seen = { path: '' }
  function LocationProbe({ label }: { label: string }) {
    seen.path = label
    return <p>{label}</p>
  }
  const utils = render(
    <MemoryRouter initialEntries={[`/units/unit-1/agenda/nova-reserva${search}`]}>
      <Routes>
        <Route path="/units/:unitId/agenda/nova-reserva" element={<AG6NovaReservaPage />} />
        <Route path="/units/:unitId/agenda" element={<LocationProbe label="AGENDA DIA" />} />
        <Route path="/units/:unitId/agenda/semana" element={<LocationProbe label="AGENDA SEMANA" />} />
      </Routes>
    </MemoryRouter>,
  )
  return { ...utils, seen }
}

function mockCourts() {
  return vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
}

const createdAdhocBooking = {
  ok: true as const,
  booking: {
    id: 'b1',
    courtId: 'court-1',
    courtName: 'Q1',
    type: 'adhoc' as const,
    classId: null,
    className: null,
    startAt: '2026-07-10T18:00:00.000Z',
    endAt: '2026-07-10T19:00:00.000Z',
    status: 'confirmed' as const,
    teacherName: null,
    studentName: null,
    responsibleName: 'Carlos',
    reason: null,
    unitId: 'unit-1',
    unitName: 'Arena Areia Dourada',
    checkedIn: false,
    studentCount: 0,
  },
}

describe('AG6NovaReservaPage', () => {
  it('shows all 4 type-chips exactly as the frame (12:280 / 94:1656)', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    renderPage()

    for (const label of ['Turma', 'Particular', 'Avulsa', 'Bloqueio']) {
      expect(await screen.findByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('switches fields when the Bloqueio chip is selected, with the exact hint copy', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Bloqueio' }))

    expect(screen.getByLabelText('Motivo')).toBeInTheDocument()
    expect(screen.getByLabelText('Até (data fim)')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Bloqueio não verifica nem cancela reservas existentes automaticamente — confirme que a quadra está livre no período antes de criar.',
      ),
    ).toBeInTheDocument()
  })

  it('creates an "Avulsa" booking (type=adhoc) for real via POST /units/{id}/bookings', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    const createBookingSpy = vi.spyOn(bookingsApi, 'createBooking').mockResolvedValue(createdAdhocBooking)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Avulsa' }))
    await userEvent.type(screen.getByLabelText('Responsável'), 'Carlos')
    await userEvent.click(screen.getByRole('button', { name: 'Criar reserva' }))

    expect(createBookingSpy).toHaveBeenCalledWith(
      'unit-1',
      expect.objectContaining({ type: 'adhoc', courtId: 'court-1', responsibleName: 'Carlos' }),
    )
    expect(await screen.findByText(/Reserva criada/)).toBeInTheDocument()
  })

  it('shows an "unavailable" message instead of a fake call when an existing Turma is selected', async () => {
    mockCourts()
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
    renderPage()

    expect(await screen.findByText('BT intermediária')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Turma'), 'class-1')
    await userEvent.click(screen.getByRole('button', { name: 'Criar reserva' }))

    expect(await screen.findByText(/ainda não está disponível/)).toBeInTheDocument()
    expect(createClassSpy).not.toHaveBeenCalled()
  })

  /* ------------------------------------------------------------------
     Novos: o que a conversão de sheet para página trouxe. */

  it('prefills court, date and hours from the query params (was the `prefill` prop)', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    renderPage('?court=court-1&date=2026-07-18&hour=9&from=dia&fromDate=2026-07-18')

    expect(await screen.findByLabelText('Data')).toHaveValue('18/07/2026')
    expect(screen.getByLabelText('Início')).toHaveValue('09:00')
    expect(screen.getByLabelText('Fim')).toHaveValue('10:00')
    expect(await screen.findByRole('button', { name: /Q1/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('goes back to the DAY agenda, on the origin day, when cancelling from AG1', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    const { seen } = renderPage('?date=2026-07-18&from=dia&fromDate=2026-07-18')

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(seen.path).toBe('AGENDA DIA')
    expect(screen.getByText('AGENDA DIA')).toBeInTheDocument()
  })

  it('goes back to the WEEK agenda when cancelling from AG2 (not to a fixed destination)', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    const { seen } = renderPage('?court=court-1&from=semana&fromDate=2026-07-13')

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(seen.path).toBe('AGENDA SEMANA')
  })

  /* Timers reais de propósito: a volta é adiada 1100ms para o aviso de
     sucesso ser lido, e o que importa aqui é que ela ACONTEÇA e no destino
     certo. Com fake timers o `navigate` disparado dentro do `setTimeout` cai
     fora de um `act()`, e o React não chega a repintar a rota nova. */
  it('returns to the WEEK agenda after a successful creation that came from AG2', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    vi.spyOn(bookingsApi, 'createBooking').mockResolvedValue(createdAdhocBooking)
    renderPage('?court=court-1&from=semana&fromDate=2026-07-13')

    await userEvent.click(await screen.findByRole('button', { name: 'Avulsa' }))
    await userEvent.type(screen.getByLabelText('Responsável'), 'Carlos')
    await userEvent.click(screen.getByRole('button', { name: 'Criar reserva' }))

    expect(await screen.findByText(/Reserva criada/)).toBeInTheDocument()
    expect(await screen.findByText('AGENDA SEMANA', undefined, { timeout: 3000 })).toBeInTheDocument()
  })

  it('falls back to the day agenda when opened as a deep link with no origin', async () => {
    mockCourts()
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    const { seen } = renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(seen.path).toBe('AGENDA DIA')
  })
})
