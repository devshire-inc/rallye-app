import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as courtsApi from '../../lib/api/courts'
import * as tournamentsApi from '../../lib/api/tournaments'
import type { TournamentDetail } from '../../lib/api/tournaments'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import TournamentFormPage from './TournamentFormPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage(unitId = 'unit-1') {
  return renderWithPermissions(
    <MemoryRouter initialEntries={[`/units/${unitId}/tournaments/new`]}>
      <Routes>
        <Route path="/units/:unitId/tournaments/new" element={<TournamentFormPage />} />
        <Route path="/units/:unitId/tournaments" element={<div>Lista de torneios placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function draftTournament(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
  return {
    id: 'tournament-1',
    unitId: 'unit-1',
    name: 'Copa Primavera',
    sport: 'beach_tennis',
    type: 'fechado',
    startDate: '2026-09-20',
    endDate: '2026-09-21',
    courtIds: [],
    bannerUrl: null,
    rules: null,
    status: 'rascunho',
    entryFee: 0,
    registrationOpensAt: null,
    registrationClosesAt: null,
    requiresPayment: true,
    bracketFormat: 'single_elimination',
    useRankingPoints: false,
    createdBy: 'user-1',
    createdAt: '2026-07-23T10:00:00Z',
    categories: [],
    rankingRules: [
      { id: 'rr-1', tournamentId: 'tournament-1', placement: 'campeao', points: 100 },
      { id: 'rr-2', tournamentId: 'tournament-1', placement: 'vice', points: 70 },
      { id: 'rr-3', tournamentId: 'tournament-1', placement: 'terceiro', points: 50 },
      { id: 'rr-4', tournamentId: 'tournament-1', placement: 'semifinalista', points: 35 },
      { id: 'rr-5', tournamentId: 'tournament-1', placement: 'quartas', points: 20 },
      { id: 'rr-6', tournamentId: 'tournament-1', placement: 'participacao', points: 10 },
    ],
    ...overrides,
  }
}

function mockCourts() {
  vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({
    ok: true,
    courts: [
      { id: 'court-1', unitId: 'unit-1', name: 'Quadra 1', sport: 'beach_tennis', status: 'active' },
      { id: 'court-2', unitId: 'unit-1', name: 'Quadra 2', sport: 'beach_tennis', status: 'active' },
    ],
  })
}

describe('TournamentFormPage — navegação entre steps', () => {
  it('começa no Step 1 (Dados) com Anterior desabilitado', () => {
    mockCourts()
    renderPage()

    expect(screen.getByRole('tab', { name: /1Dados/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Nome')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled()
  })

  it('navega pelos 4 steps via Próximo/Anterior, desabilitando Próximo no último', async () => {
    mockCourts()
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('tab', { name: /2Categorias/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: '+ Adicionar categoria' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('tab', { name: /3Inscrições/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Taxa por dupla')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('tab', { name: /4Pontuação/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByRole('tab', { name: /3Inscrições/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('"Salvar rascunho" está disponível em qualquer step', async () => {
    mockCourts()
    renderPage()

    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument()
  })
})

describe('TournamentFormPage — Step 2 (Categorias)', () => {
  it('adiciona e remove categorias localmente, sem chamar a API', async () => {
    mockCourts()
    const patchCategoriesSpy = vi.spyOn(tournamentsApi, 'patchTournamentCategories')
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))

    expect(screen.getByText('Nenhuma categoria adicionada.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar categoria' }))
    expect(screen.getByLabelText('Nome da categoria 1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar categoria' }))
    expect(screen.getByLabelText('Nome da categoria 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remover categoria 1' }))
    expect(screen.queryByLabelText('Nome da categoria 2')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome da categoria 1')).toBeInTheDocument()

    expect(patchCategoriesSpy).not.toHaveBeenCalled()
  })
})

describe('TournamentFormPage — Step 3 (Inscrições)', () => {
  it('checkbox de pagamento começa marcado (timeout 24h) e é alternável', async () => {
    mockCourts()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))

    const checkbox = screen.getByRole('checkbox', {
      name: /Inscrição confirma só após pagamento \(timeout 24h libera a vaga\)/,
    })
    expect(checkbox).toBeChecked()

    await userEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })
})

describe('TournamentFormPage — Step 4 (Pontuação)', () => {
  it('mostra os 6 defaults de pontuação (100/70/50/35/20/10) editáveis', async () => {
    mockCourts()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))

    expect(screen.getByLabelText('Pontos — Campeão')).toHaveValue(100)
    expect(screen.getByLabelText('Pontos — Vice')).toHaveValue(70)
    expect(screen.getByLabelText('Pontos — 3º lugar')).toHaveValue(50)
    expect(screen.getByLabelText('Pontos — Semifinal')).toHaveValue(35)
    expect(screen.getByLabelText('Pontos — Quartas')).toHaveValue(20)
    expect(screen.getByLabelText('Pontos — Participação')).toHaveValue(10)
    expect(
      screen.getByText(/Pontuação alimenta os rankings/),
    ).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Pontos — Campeão'))
    await userEvent.type(screen.getByLabelText('Pontos — Campeão'), '150')
    expect(screen.getByLabelText('Pontos — Campeão')).toHaveValue(150)
  })
})

describe('TournamentFormPage — Salvar rascunho', () => {
  it('no primeiro save chama createTournament (não patchTournament) com os dados do Step 1', async () => {
    mockCourts()
    const createSpy = vi
      .spyOn(tournamentsApi, 'createTournament')
      .mockResolvedValue({ ok: true, tournament: draftTournament() })
    const patchSpy = vi.spyOn(tournamentsApi, 'patchTournament')
    vi.spyOn(tournamentsApi, 'patchTournamentRankingRules').mockResolvedValue({
      ok: true,
      rankingRules: draftTournament().rankingRules,
    })

    renderPage()
    await userEvent.type(screen.getByLabelText('Nome'), 'Copa Primavera')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument()
    expect(createSpy).toHaveBeenCalledWith(
      'unit-1',
      expect.objectContaining({
        name: 'Copa Primavera',
        sport: 'beach_tennis',
        type: 'fechado',
        bracketFormat: 'single_elimination',
      }),
    )
    expect(patchSpy).not.toHaveBeenCalled()
  })

  it('no segundo save reusa o id e chama patchTournament (não createTournament de novo)', async () => {
    mockCourts()
    vi.spyOn(tournamentsApi, 'createTournament').mockResolvedValue({
      ok: true,
      tournament: draftTournament(),
    })
    const patchSpy = vi
      .spyOn(tournamentsApi, 'patchTournament')
      .mockResolvedValue({ ok: true, tournament: draftTournament() })
    vi.spyOn(tournamentsApi, 'patchTournamentRankingRules').mockResolvedValue({
      ok: true,
      rankingRules: draftTournament().rankingRules,
    })

    renderPage()
    await userEvent.type(screen.getByLabelText('Nome'), 'Copa Primavera')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await screen.findByText('Rascunho salvo.')

    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(tournamentsApi.createTournament).toHaveBeenCalledTimes(1)
    expect(patchSpy).toHaveBeenCalledWith('tournament-1', expect.objectContaining({ name: 'Copa Primavera' }))
  })

  it('salva categorias preenchidas junto com o rascunho (PATCH /tournaments/{id}/categories)', async () => {
    mockCourts()
    vi.spyOn(tournamentsApi, 'createTournament').mockResolvedValue({
      ok: true,
      tournament: draftTournament(),
    })
    const patchCategoriesSpy = vi.spyOn(tournamentsApi, 'patchTournamentCategories').mockResolvedValue({
      ok: true,
      categories: [
        {
          id: 'cat-1',
          tournamentId: 'tournament-1',
          name: 'Masculina B',
          skillTier: null,
          genderScope: 'masculino',
          modality: 'duplas',
          maxParticipants: 16,
          bracketFormat: null,
        },
      ],
    })
    vi.spyOn(tournamentsApi, 'patchTournamentRankingRules').mockResolvedValue({
      ok: true,
      rankingRules: draftTournament().rankingRules,
    })

    renderPage()
    await userEvent.type(screen.getByLabelText('Nome'), 'Copa Primavera')
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar categoria' }))
    await userEvent.type(screen.getByLabelText('Nome da categoria 1'), 'Masculina B')

    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument()
    expect(patchCategoriesSpy).toHaveBeenCalledWith(
      'tournament-1',
      expect.arrayContaining([expect.objectContaining({ name: 'Masculina B' })]),
    )
  })

  it('mostra o erro do backend e não avança quando o save falha', async () => {
    mockCourts()
    vi.spyOn(tournamentsApi, 'createTournament').mockResolvedValue({
      ok: false,
      status: 400,
      error: 'invalid_body',
      message: 'name é obrigatório',
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('name é obrigatório')
  })

  it('back link volta para a lista de torneios da unit', async () => {
    mockCourts()
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '‹ Torneios' }))

    expect(await screen.findByText('Lista de torneios placeholder')).toBeInTheDocument()
  })
})
