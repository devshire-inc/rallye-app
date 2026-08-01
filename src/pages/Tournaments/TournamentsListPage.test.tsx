import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as usePermissionModule from '../../hooks/usePermission'
import * as tournamentsApi from '../../lib/api/tournaments'
import type { TournamentListItem, TournamentListScope } from '../../lib/api/tournaments'
import TournamentsListPage from './TournamentsListPage'

const NOW = new Date('2026-07-23T12:00:00Z')

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function tournament(overrides: Partial<TournamentListItem> = {}): TournamentListItem {
  return {
    id: 'tournament-1',
    name: 'Copa Areia Dourada',
    sport: 'beach_tennis',
    type: 'fechado',
    status: 'em_andamento',
    startDate: '2026-07-12',
    endDate: '2026-07-14',
    registrationOpensAt: null,
    registrationClosesAt: null,
    champions: null,
    ...overrides,
  }
}

function mockList(byScope: Partial<Record<TournamentListScope, TournamentListItem[]>>) {
  vi.spyOn(tournamentsApi, 'listTournaments').mockImplementation((_unitId, scope) =>
    Promise.resolve({ ok: true, scope, tournaments: byScope[scope] ?? [] }),
  )
}

function renderPage(unitId = 'unit-1') {
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/units/${unitId}/tournaments`]}>
      <Routes>
        <Route path="/units/:unitId/tournaments" element={<TournamentsListPage />} />
        <Route path="/units/:unitId/tournaments/new" element={<div>Criar torneio placeholder</div>} />
        <Route path="/tournaments/:tournamentId" element={<div>Detalhe do torneio placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TournamentsListPage — loading and error', () => {
  it('shows a loading status while tournaments are being fetched', () => {
    mockPermissions({})
    vi.spyOn(tournamentsApi, 'listTournaments').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    mockPermissions({})
    vi.spyOn(tournamentsApi, 'listTournaments').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('TournamentsListPage — tabs', () => {
  it('defaults to "Meus" (scope=mine) and loads its tournaments', async () => {
    mockPermissions({})
    mockList({ mine: [tournament({ name: 'Copa Primavera' })] })

    renderPage()

    expect(await screen.findByText('Copa Primavera')).toBeInTheDocument()
    expect(tournamentsApi.listTournaments).toHaveBeenCalledWith('unit-1', 'mine')
    expect(screen.getByRole('tab', { name: 'Meus' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to "Abertos" (scope=abertos) — cross-arena content as returned', async () => {
    mockPermissions({})
    mockList({
      mine: [tournament({ id: 't-mine', name: 'Copa Primavera' })],
      abertos: [tournament({ id: 't-open', name: 'Open de Padel', status: 'publicado' })],
    })

    renderPage()
    await screen.findByText('Copa Primavera')

    await userEvent.click(screen.getByRole('tab', { name: 'Abertos' }))

    expect(await screen.findByText('Open de Padel')).toBeInTheDocument()
    expect(screen.queryByText('Copa Primavera')).not.toBeInTheDocument()
    expect(tournamentsApi.listTournaments).toHaveBeenCalledWith('unit-1', 'abertos')
  })

  it('switches to "Encerrados" (scope=encerrados)', async () => {
    mockPermissions({})
    mockList({
      mine: [],
      encerrados: [tournament({ id: 't-closed', name: 'Torneio de Outono', status: 'encerrado' })],
    })

    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Encerrados' }))

    expect(await screen.findByText('Torneio de Outono')).toBeInTheDocument()
    expect(tournamentsApi.listTournaments).toHaveBeenCalledWith('unit-1', 'encerrados')
  })
})

describe('TournamentsListPage — sections', () => {
  it('puts em_andamento tournaments under "Ao vivo"', async () => {
    mockPermissions({})
    mockList({ mine: [tournament({ status: 'em_andamento', name: 'Copa Areia Dourada' })] })

    renderPage()

    expect(await screen.findByText('Ao vivo')).toBeInTheDocument()
    expect(screen.getByText('Copa Areia Dourada')).toBeInTheDocument()
  })

  it('puts publicado/rascunho tournaments under "Inscrições abertas" and shows the countdown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
    mockPermissions({})
    mockList({
      mine: [
        tournament({
          status: 'publicado',
          name: 'Desafio de Futevôlei',
          registrationClosesAt: '2026-07-28T23:59:59-03:00',
        }),
      ],
    })

    renderPage()

    expect(await screen.findByText('Inscrições abertas')).toBeInTheDocument()
    expect(screen.getByText('Desafio de Futevôlei')).toBeInTheDocument()
    expect(screen.getByText('encerra em 5 dias')).toBeInTheDocument()
  })

  it('shows a "Rascunho" badge for draft tournaments (no countdown fabricated)', async () => {
    mockPermissions({})
    mockList({ mine: [tournament({ status: 'rascunho', name: 'Torneio inacabado' })] })

    renderPage()

    await screen.findByText('Torneio inacabado')
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
  })

  it('puts encerrado tournaments under "Encerrados"', async () => {
    mockPermissions({})
    mockList({ mine: [tournament({ status: 'encerrado', name: 'Torneio de Outono' })] })

    renderPage()

    expect(await screen.findByText('Encerrados')).toBeInTheDocument()
    expect(screen.getByText('Torneio de Outono')).toBeInTheDocument()
  })

  it('shows the champion only when champions data is present (only populated on scope=encerrados)', async () => {
    mockPermissions({})
    mockList({
      mine: [tournament({ status: 'encerrado', name: 'Torneio de Outono', champions: null })],
      encerrados: [
        tournament({
          status: 'encerrado',
          name: 'Torneio de Outono',
          champions: [{ categoryName: 'Fem B', championName: 'Marina & Carla' }],
        }),
      ],
    })

    renderPage()
    await screen.findByText('Torneio de Outono')
    expect(screen.queryByText(/🏆/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Encerrados' }))

    expect(await screen.findByText('🏆 Marina & Carla (Fem B)')).toBeInTheDocument()
  })
})

describe('TournamentsListPage — "Criar" button', () => {
  it('shows "Criar" for a user with torneios:write and navigates to TO2', async () => {
    mockPermissions({ 'torneios:write': true })
    mockList({ mine: [] })

    renderPage()
    await screen.findByText('Nenhum torneio no momento')

    await userEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(await screen.findByText('Criar torneio placeholder')).toBeInTheDocument()
  })

  it('hides "Criar" for a user without torneios:write', async () => {
    mockPermissions({ 'torneios:write': false })
    mockList({ mine: [] })

    renderPage()

    await screen.findByText('Nenhum torneio no momento')
    expect(screen.queryByRole('button', { name: 'Criar' })).not.toBeInTheDocument()
  })
})

describe('TournamentsListPage — navigation', () => {
  it('navigates to TO3 when a tournament card is tapped', async () => {
    mockPermissions({})
    mockList({ mine: [tournament({ name: 'Copa Areia Dourada' })] })

    renderPage()
    await screen.findByText('Copa Areia Dourada')

    await userEvent.click(screen.getByTestId('tournament-card-tournament-1'))

    expect(await screen.findByText('Detalhe do torneio placeholder')).toBeInTheDocument()
  })

  it('navigates a draft card to TO2 instead of TO3 (rascunho não tem página pública)', async () => {
    mockPermissions({})
    mockList({ mine: [tournament({ name: 'Rascunho de Verão', status: 'rascunho' })] })

    renderPage()
    await screen.findByText('Rascunho de Verão')

    await userEvent.click(screen.getByTestId('tournament-card-tournament-1'))

    expect(await screen.findByText('Criar torneio placeholder')).toBeInTheDocument()
  })
})
