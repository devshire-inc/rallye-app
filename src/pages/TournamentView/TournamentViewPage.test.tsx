import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as usePermissionModule from '../../hooks/usePermission'
import * as courtsApi from '../../lib/api/courts'
import * as membersApi from '../../lib/api/members'
import * as tournamentApi from '../../lib/api/tournamentWithdrawal'
import type { TournamentDetail, TournamentRegistration } from '../../lib/api/tournamentWithdrawal'
import { TournamentViewPage } from './TournamentViewPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function tournament(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
  return {
    id: 'tournament-1',
    unitId: 'unit-1',
    name: 'Copa Areia Dourada',
    sport: 'beach_tennis',
    type: 'aberto',
    startDate: '2026-07-12',
    endDate: '2026-07-14',
    courtIds: ['court-1', 'court-2'],
    rules: 'Eliminatória simples · sets de 7 games.',
    status: 'em_andamento',
    entryFee: 80,
    categories: [{ id: 'cat-1', tournamentId: 'tournament-1', name: 'Feminina B', maxParticipants: 16 }],
    ...overrides,
  }
}

function registration(overrides: Partial<TournamentRegistration> = {}): TournamentRegistration {
  return {
    id: 'reg-1',
    categoryId: 'cat-1',
    player1Id: 'user-1',
    player2Id: 'user-2',
    player2ManualName: null,
    player2ManualEmail: null,
    status: 'confirmed',
    invoiceId: 'invoice-1',
    ...overrides,
  }
}

function mockCourtsAndMembers() {
  vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({
    ok: true,
    courts: [
      { id: 'court-1', unitId: 'unit-1', name: 'Q1', sport: 'beach_tennis', status: 'active' },
      { id: 'court-2', unitId: 'unit-1', name: 'Q2', sport: 'beach_tennis', status: 'active' },
    ],
  })
  vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
    ok: true,
    members: [
      {
        membershipId: 'm1',
        user: { id: 'user-1', name: 'Marina Costa', email: null, avatarUrl: null },
        role: null,
      },
      {
        membershipId: 'm2',
        user: { id: 'user-2', name: 'Carla Trindade', email: null, avatarUrl: null },
        role: null,
      },
    ],
  })
}

function renderPage(tournamentId = 'tournament-1', search = '') {
  return render(
    <MemoryRouter initialEntries={[`/tournaments/${tournamentId}${search}`]}>
      <Routes>
        <Route path="/tournaments/:tournamentId" element={<TournamentViewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TournamentViewPage — loading/not-found/unavailable', () => {
  it('shows a loading status while the tournament is being fetched', () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a not-found message on 404', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'tournament_not_found',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não encontrado/i)
  })

  it('does not break the screen for an anonymous visitor (401, gap conhecido de BEAC-1991)', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({
      ok: false,
      status: 401,
      error: 'unauthorized',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('TournamentViewPage — ?notifications=1 (integração com VisitorVerifyPage, A5)', () => {
  it('shows the "Notificações ativadas" status when the query param is present', () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockReturnValue(new Promise(() => {}))

    renderPage('tournament-1', '?notifications=1')

    expect(screen.getByText('Notificações ativadas para este torneio.')).toBeInTheDocument()
  })

  it('does not show it when the query param is absent', () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.queryByText('Notificações ativadas para este torneio.')).not.toBeInTheDocument()
  })
})

describe('TournamentViewPage — header', () => {
  it('renders name, AO VIVO badge, sport/type/dates/courts/fee', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({ ok: true, tournament: tournament() })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({ ok: true, registrations: [] })
    mockCourtsAndMembers()

    renderPage()

    expect(await screen.findByRole('heading', { name: /Copa Areia Dourada/ })).toBeInTheDocument()
    expect(screen.getByText('AO VIVO')).toBeInTheDocument()
    expect(
      await screen.findByText(/Beach tennis · aberto · 12–14 jul · Q1 e Q2 · taxa/),
    ).toBeInTheDocument()
  })

  it('omits the AO VIVO badge when the tournament is not em_andamento', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({
      ok: true,
      tournament: tournament({ status: 'publicado' }),
    })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({ ok: true, registrations: [] })
    mockCourtsAndMembers()

    renderPage()

    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })
    expect(screen.queryByText('AO VIVO')).not.toBeInTheDocument()
  })
})

describe('TournamentViewPage — Info tab', () => {
  it('shows category occupancy computed from registrations, regulamento and an Inscrever-se link to TO4', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({ ok: true, tournament: tournament() })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({
      ok: true,
      registrations: [
        registration({ id: 'reg-1', status: 'confirmed' }),
        registration({ id: 'reg-2', status: 'confirmed' }),
      ],
    })
    mockCourtsAndMembers()

    renderPage()
    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })

    expect(await screen.findByText('2/16 · 14 vagas')).toBeInTheDocument()
    expect(screen.getByText(/Eliminatória simples/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inscrever-se' })).toHaveAttribute(
      'href',
      '/tournaments/tournament-1/register',
    )
  })

  it('marks a category as "lotada" when confirmed registrations reach max_participants', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({
      ok: true,
      tournament: tournament({
        categories: [{ id: 'cat-1', tournamentId: 'tournament-1', name: 'Feminina B', maxParticipants: 1 }],
      }),
    })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({
      ok: true,
      registrations: [registration({ status: 'confirmed' })],
    })
    mockCourtsAndMembers()

    renderPage()

    expect(await screen.findByText('1/1 · lotada')).toBeInTheDocument()
  })
})

describe('TournamentViewPage — Inscritos tab', () => {
  it('lists registrations grouped by category with the pair label (resolved via members) and status badge', async () => {
    mockPermissions({ 'torneios:write': false })
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({ ok: true, tournament: tournament() })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({
      ok: true,
      registrations: [
        registration({ id: 'reg-1', status: 'confirmed' }),
        registration({ id: 'reg-2', status: 'pending_payment', player2Id: null, player2ManualName: null }),
      ],
    })
    mockCourtsAndMembers()

    renderPage()
    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Inscritos' }))

    expect(await screen.findByText('Marina Costa / Carla Trindade')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText('Pagamento pendente')).toBeInTheDocument()
    // Sem torneios:write, o botão "Desistiu" não aparece em nenhuma linha.
    expect(screen.queryByRole('button', { name: 'Desistiu' })).not.toBeInTheDocument()
  })

  it('shows "Desistiu" only for Admin (torneios:write) and only on confirmed registrations, opening the withdraw sheet', async () => {
    mockPermissions({ 'torneios:write': true })
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({ ok: true, tournament: tournament() })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({
      ok: true,
      registrations: [
        registration({ id: 'reg-1', status: 'confirmed' }),
        registration({
          id: 'reg-2',
          status: 'pending_payment',
          player1Id: 'user-3',
          player2Id: null,
          player2ManualName: 'Ana Clara',
        }),
      ],
    })
    mockCourtsAndMembers()

    renderPage()
    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Inscritos' }))
    await screen.findByText('Marina Costa / Carla Trindade')

    expect(screen.getAllByRole('button', { name: 'Desistiu' })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Desistiu' }))

    expect(screen.getByRole('dialog', { name: 'Jogador desistiu' })).toBeInTheDocument()
    expect(screen.getByText('Marina Costa / Carla Trindade · Feminina B')).toBeInTheDocument()
  })

  it('shows a graceful message instead of breaking when registrations are unavailable (BEAC-1991 gap)', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({ ok: true, tournament: tournament() })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'arena_selection_required',
    })
    mockCourtsAndMembers()

    renderPage()
    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Inscritos' }))

    expect(await screen.findByText(/indisponíveis agora/i)).toBeInTheDocument()
  })
})

describe('TournamentViewPage — Chaves tab', () => {
  it('links to TO5 (bracket) once the tournament is em_andamento/encerrado', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({ ok: true, tournament: tournament() })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({ ok: true, registrations: [] })
    mockCourtsAndMembers()

    renderPage()
    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Chaves' }))

    expect(screen.getByRole('link', { name: 'Ver chaves' })).toHaveAttribute(
      'href',
      '/tournaments/tournament-1/bracket',
    )
  })

  it('shows "ainda não foi gerado" while the tournament is rascunho/publicado', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({
      ok: true,
      tournament: tournament({ status: 'publicado' }),
    })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({ ok: true, registrations: [] })
    mockCourtsAndMembers()

    renderPage()
    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Chaves' }))

    expect(screen.getByText(/ainda não foi gerado/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver chaves' })).not.toBeInTheDocument()
  })
})

describe('TournamentViewPage — Ranking tab', () => {
  it('shows the exact toast copy before the tournament ends', async () => {
    mockPermissions({})
    vi.spyOn(tournamentApi, 'getTournament').mockResolvedValue({ ok: true, tournament: tournament() })
    vi.spyOn(tournamentApi, 'listCategoryRegistrations').mockResolvedValue({ ok: true, registrations: [] })
    mockCourtsAndMembers()

    renderPage()
    await screen.findByRole('heading', { name: /Copa Areia Dourada/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Ranking' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'O ranking do torneio aparece aqui após o encerramento — veja o ranking geral em TO8.',
    )
  })
})
