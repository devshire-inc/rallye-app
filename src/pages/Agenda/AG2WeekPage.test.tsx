import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import type { Booking } from '../../lib/api/bookings'
import * as courtsApi from '../../lib/api/courts'
import { PermissionsProvider } from '../../context/PermissionsContext'
import { QueryTestProvider } from '../../test/queryTestClient'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import AG2WeekPage from './AG2WeekPage'
import { weekDaysSunday } from './agendaShared'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/* Relógio fixo: a grade destaca o dia de HOJE e desenha a linha do "agora", e a
 * semana exibida é a de `new Date()` — sem fixar o relógio o teste muda de
 * resultado conforme o dia em que roda. 28/07/2026 é uma TERÇA, então a semana
 * dom-sáb é 26/07 a 01/08 (a mesma dos frames). */
const FIXED = new Date('2026-07-28T10:30:00')

const courts: courtsApi.Court[] = [
  { id: 'court-1', unitId: 'unit-1', name: 'Q1', sport: 'beach_tennis', status: 'active' },
  { id: 'court-2', unitId: 'unit-1', name: 'Q2', sport: 'futevolei', status: 'active' },
]

function at(dayOfMonth: number, hour: number): string {
  return new Date(2026, 6, dayOfMonth, hour, 0, 0).toISOString()
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    courtId: 'court-1',
    courtName: 'Q1',
    type: 'class_occurrence',
    classId: 'cl1',
    className: 'BT Iniciante',
    startAt: at(28, 7),
    endAt: at(28, 8),
    status: 'confirmed',
    teacherName: 'Marcus Lima',
    studentName: null,
    responsibleName: null,
    reason: null,
    unitId: 'unit-1',
    unitName: 'Arena Beira-Mar',
    checkedIn: false,
    studentCount: 6,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(FIXED)
})

function mockApis(options: { bookings?: Booking[]; viewOnly?: boolean } = {}) {
  vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
  vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
    ok: true,
    bookings: options.bookings ?? [],
    viewOnly: options.viewOnly ?? false,
  })
}

/** Stand-in de AG6 que publica a query string recebida, para as asserções de
 * "a volta para a semana não quebrou". */
function Ag6Placeholder() {
  const [params] = useSearchParams()
  return (
    <div>
      AG6 placeholder<span data-testid="ag6-search">{params.toString()}</span>
    </div>
  )
}

function routedTree() {
  return (
    <MemoryRouter initialEntries={['/units/unit-1/agenda/semana']}>
      <Routes>
        <Route path="/units/:unitId/agenda" element={<div>AG1 placeholder</div>} />
        <Route path="/units/:unitId/agenda/semana" element={<AG2WeekPage />} />
        <Route path="/units/:unitId/agenda/nova-reserva" element={<Ag6Placeholder />} />
        <Route path="/units/:unitId/bookings/:bookingId" element={<div>AG5 placeholder</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderPage() {
  return renderWithPermissions(routedTree())
}

/* Render em StrictMode. O `<StrictMode>` precisa ser o elemento RAIZ passado ao
 * `render`, com os providers DENTRO dele: com qualquer componente acima (é o
 * caso de `renderWithPermissions`, que embrulha em QueryTestProvider +
 * PermissionsProvider), o React não executa a simulação de monta -> desmonta ->
 * monta e o defeito de `mountedRef` fica invisível. Medido: com os providers por
 * fora o efeito roda uma única vez ["setup"]; com o StrictMode na raiz roda
 * ["setup","cleanup","setup"], que é a sequência que expõe o defeito. */
function renderPageStrict() {
  return render(
    <StrictMode>
      <QueryTestProvider>
        <PermissionsProvider>{routedTree()}</PermissionsProvider>
      </QueryTestProvider>
    </StrictMode>,
  )
}

/* A tela renderiza AS DUAS variantes (dentro de AgendaMobile e de
 * AgendaDesktop) e o CSS esconde uma — ver AG2WeekPage.css, mesmo padrão de
 * AG1DayPage. Em jsdom nenhuma media query se aplica, então as duas existem no
 * DOM: toda consulta de texto/controle compartilhado escopa por um dos dois
 * blocos, nunca por `screen` direto. */
function mobile(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('.ag2-page__mobile')!
}

function desktop(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('.ag2-page__desktop')!
}

describe('AG2WeekPage', () => {
  it('shows only 1 quadra (dropdown) and the 7 weekdays as columns, sunday first', async () => {
    mockApis()

    const { container } = renderPage()

    const grid = desktop(container)
    expect(await within(grid).findByLabelText('Quadra')).toBeInTheDocument()

    // Ordem DOM..SÁB e os números 26..1 da semana dos frames (26/07 a 01/08).
    const heads = grid.querySelectorAll('.ag2-week__day-head')
    expect(Array.from(heads).map((head) => head.textContent)).toEqual([
      'DOM26',
      'SEG27',
      'TER28',
      'QUA29',
      'QUI30',
      'SEX31',
      'SÁB1',
    ])

    // A quadra é UMA por vez (dropdown), não uma coluna por quadra: os nomes de
    // quadra existem só como opção do select.
    expect(within(grid).queryByText('Q2')).not.toBeInTheDocument()
  })

  it('marks today with data-today and draws the now line on the desktop grid only', async () => {
    mockApis()

    const { container } = renderPage()
    await within(desktop(container)).findByLabelText('Quadra')

    const todayHeads = container.querySelectorAll('.ag2-week__day-head[data-today="true"]')
    // Uma por variante (mobile + desktop), sempre a TER 28 do relógio fixo.
    expect(todayHeads).toHaveLength(2)
    for (const head of todayHeads) expect(head.textContent).toBe('TER28')

    expect(desktop(container).querySelector('.ag2-week__now')).toBeInTheDocument()
    expect(mobile(container).querySelector('.ag2-week__now')).not.toBeInTheDocument()
    expect(desktop(container).querySelector('.ag2-week__now-label')!.textContent).toBe('10:30')
  })

  it('asks the API for the sunday-to-sunday window the grid draws', async () => {
    mockApis()

    renderPage()
    await waitFor(() => expect(bookingsApi.getBookingsGrid).toHaveBeenCalled())

    const days = weekDaysSunday(FIXED)
    const nextSunday = new Date(days[0]!)
    nextSunday.setDate(nextSunday.getDate() + 7)
    expect(bookingsApi.getBookingsGrid).toHaveBeenCalledWith(
      'unit-1',
      days[0]!.toISOString(),
      nextSunday.toISOString(),
      'court-1',
    )
  })

  it('places a booking on its own day column and hour row', async () => {
    mockApis({ bookings: [booking()] })

    const { container } = renderPage()

    // Terça 28/07 = 3ª coluna (índice 2) -> --ag2-col 4; 07h = 2ª faixa -> linha 3.
    // `waitFor` com uma asserção dentro, não com um `querySelector` que devolve
    // null sem lançar: sem a asserção o waitFor resolve no primeiro tick com
    // null e o teste não espera por nada.
    const block = await waitFor(() => {
      const found = desktop(container).querySelector<HTMLElement>('.ag2-week__booking')
      expect(found).not.toBeNull()
      return found!
    })
    expect(block.style.getPropertyValue('--ag2-col')).toBe('4')
    expect(block.style.getPropertyValue('--ag2-row-start')).toBe('3')
    expect(block.style.getPropertyValue('--ag2-row-end')).toBe('4')
    expect(block.dataset.tone).toBe('confirmado')
    expect(within(block).getByText('BT Iniciante')).toBeInTheDocument()
    expect(within(block).getByText('Prof. Marcus Lima')).toBeInTheDocument()

    // A hora ocupada não deixa célula livre para trás naquele dia/faixa.
    const freeAtSameSlot = Array.from(
      desktop(container).querySelectorAll<HTMLElement>('.ag2-week__cell'),
    ).filter(
      (cell) =>
        cell.style.getPropertyValue('--ag2-col') === '4' &&
        cell.style.getPropertyValue('--ag2-row') === '3',
    )
    expect(freeAtSameSlot).toHaveLength(0)
  })

  it('renders the week stats footer with occupancy/free slots and no revenue data', async () => {
    mockApis({ bookings: [booking()] })

    const { container } = renderPage()

    /* Barreira: o BLOCO da reserva no DOM, não `getBookingsGrid` ter sido
     * chamada. A chamada acontece no corpo de `reloadBookings` e o setState só
     * no `.then` — esperar pela chamada liberava a asserção com `bookings`
     * ainda vazio e o rodapé mostrando 112 livres (a corrida corrigida em
     * a983267, que não pode voltar por uma porta lateral). */
    await waitFor(() =>
      expect(desktop(container).querySelector('.ag2-week__booking')).toBeInTheDocument(),
    )

    const stats = desktop(container).querySelector<HTMLElement>('.ag2-stats')!
    expect(within(stats).getByText('Ocupação da semana')).toBeInTheDocument()
    expect(within(stats).getByText('Horários livres')).toBeInTheDocument()
    expect(within(stats).getByText('Receita da quadra')).toBeInTheDocument()
    expect(within(stats).getByText('indisponível')).toBeInTheDocument()
    // 7 dias x 16 faixas = 112; uma reserva confirmada de 1h ocupa 1.
    expect(within(stats).getByText('111')).toBeInTheDocument()
  })

  /* Nada de referência interna na UI: o `title` do "indisponível" citava o
   * "relatório de dispatch", que é artefato de processo e não existe para quem
   * usa o app — mesmo defeito de e77fe27 (caminho de arquivo Go num ticket) e
   * de a983267 (slug cru do banco). */
  it('never leaks internal process references or raw DB slugs to the UI', async () => {
    mockApis()

    const { container } = renderPage()
    const grid = desktop(container)
    await within(grid).findByLabelText('Quadra')

    expect(within(grid).getByText('indisponível').getAttribute('title')).not.toMatch(
      /dispatch|relatório|BEAC-|migration/i,
    )
    // O rótulo da opção usa o nome do esporte, não o slug do banco.
    expect(within(grid).getByRole('option', { name: 'Q1 · Beach tennis' })).toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/beach_tennis|futevolei/)
  })

  /* A barreira deste teste é a RESPOSTA aplicada, não a chamada disparada.
   * `getBookingsGrid` ter sido chamada e `setViewOnly(true)` ter sido aplicado
   * são dois momentos diferentes — a chamada acontece no corpo de
   * `reloadBookings`, o setState só no `.then`. Esperar pela chamada
   * (`toHaveBeenCalled()`) liberava a asserção enquanto `viewOnly` ainda era
   * `false`, e aí a ação legitimamente existia. */
  it('hides the "+ Nova reserva" action and disables empty slots when view_only=true', async () => {
    mockApis({ viewOnly: true })

    const { container } = renderPage()

    // Barreira real: a ação nasce presente (o estado inicial de `viewOnly` é
    // `false`) e só some quando a resposta chega — esperar por ela sumir não é
    // satisfeito de graça no primeiro tick.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '+ Nova reserva' })).not.toBeInTheDocument(),
    )

    const freeSlots = within(desktop(container)).getAllByRole('button', { name: /Horário livre/ })
    expect(freeSlots.length).toBeGreaterThan(0)
    for (const slot of freeSlots) {
      expect(slot).toHaveAttribute('aria-disabled', 'true')
      expect(slot).toHaveAttribute('tabindex', '-1')
    }
  })

  /* mountedRef era inicializado em `true` e zerado na limpeza do efeito, mas
   * nunca voltava a `true`. Com o StrictMode do dev (monta -> desmonta -> monta
   * a MESMA instância) ficava `false` para sempre, todo `setBookings` era
   * descartado e a semana abria permanentemente vazia rodando `bun run dev`.
   *
   * O teste roda a tela DENTRO de <StrictMode> de propósito: é a única
   * configuração em que o defeito aparece, e sem ela o teste passaria mesmo com
   * a linha de correção removida. Mesmo defeito e mesma correção de AG1
   * (0abc631) e AG4 (fd4b759). */
  it('still applies loaded bookings after a StrictMode double mount', async () => {
    mockApis({ bookings: [booking()] })

    const { container } = renderPageStrict()

    await waitFor(() =>
      expect(desktop(container).querySelector('.ag2-week__booking')).toBeInTheDocument(),
    )
    expect(within(desktop(container)).getByText('BT Iniciante')).toBeInTheDocument()
  })

  /* A volta de AG6 para ESTA semana depende de `from=semana` + `fromDate`
   * (a983267). Asserção no destino REAL, não só em ter navegado: um
   * `novaReservaPath` que perdesse os parâmetros continuaria abrindo AG6 e
   * devolveria o usuário para a agenda do dia de hoje. */
  it('keeps from=semana and fromDate when going to Nova reserva from a free slot', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockApis()

    const { container } = renderPage()
    const grid = desktop(container)
    await within(grid).findByLabelText('Quadra')

    await user.click(within(grid).getByRole('button', { name: 'Horário livre QUA 29 9h' }))

    expect(await screen.findByText('AG6 placeholder')).toBeInTheDocument()
    const params = new URLSearchParams(screen.getByTestId('ag6-search').textContent!)
    expect(params.get('from')).toBe('semana')
    expect(params.get('fromDate')).toBe('2026-07-28')
    expect(params.get('court')).toBe('court-1')
    expect(params.get('date')).toBe('2026-07-29')
    expect(params.get('hour')).toBe('9')
  })

  it('keeps from=semana and fromDate on the footer action, without prefilling a date', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockApis()

    const { container } = renderPage()
    const grid = desktop(container)
    await within(grid).findByLabelText('Quadra')

    await user.click(within(grid).getByRole('button', { name: '+ Nova reserva' }))

    expect(await screen.findByText('AG6 placeholder')).toBeInTheDocument()
    const params = new URLSearchParams(screen.getByTestId('ag6-search').textContent!)
    expect(params.get('from')).toBe('semana')
    expect(params.get('fromDate')).toBe('2026-07-28')
    expect(params.get('court')).toBe('court-1')
    // A ação do rodapé não é de um slot: não pré-preenche dia nem hora.
    expect(params.get('date')).toBeNull()
    expect(params.get('hour')).toBeNull()
  })

  it('opens the booking detail with the booking in navigation state', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockApis({ bookings: [booking()] })

    const { container } = renderPage()
    const block = await waitFor(() => {
      const found = desktop(container).querySelector<HTMLElement>('.ag2-week__booking')
      expect(found).not.toBeNull()
      return found!
    })

    await user.click(block)
    expect(await screen.findByText('AG5 placeholder')).toBeInTheDocument()
  })

  it('navigates back to the day view from the Dia|Semana toggle', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockApis()

    const { container } = renderPage()
    const grid = desktop(container)
    await within(grid).findByLabelText('Quadra')

    await user.click(within(grid).getByRole('button', { name: 'Dia' }))
    expect(await screen.findByText('AG1 placeholder')).toBeInTheDocument()
  })

  /* O frame mobile da semana (157:4330) não desenha o toggle Dia|Semana, mas
   * sem ele quem entra na semana pelo celular não tem volta para o dia — o
   * toggle fica, e é comportamento, não estética. */
  it('keeps the Dia|Semana toggle on the mobile variant too', async () => {
    mockApis()

    const { container } = renderPage()
    const block = mobile(container)
    await within(block).findByLabelText('Quadra')

    expect(within(block).getByRole('button', { name: 'Dia' })).toBeInTheDocument()
    expect(within(block).getByRole('button', { name: 'Semana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  /* A tira de dias de AgendaMobile é o navegador de DIA de uma agenda de um
   * dia; aqui o corpo já é a semana inteira com os sete dias como colunas. */
  it('does not render AgendaMobile week strip on the week view', async () => {
    mockApis()

    const { container } = renderPage()
    await within(mobile(container)).findByLabelText('Quadra')

    expect(container.querySelector('.agenda-mobile__week-strip')).not.toBeInTheDocument()
  })

  it('surfaces a load error without wiping the grid chrome', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: false,
      status: 502,
      error: 'network',
    })

    const { container } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a agenda (network).',
    )
    expect(desktop(container).querySelector('.ag2-week__grid')).toBeInTheDocument()
  })
})
