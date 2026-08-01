import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as membersApi from '../../lib/api/members'
import type { Member } from '../../lib/api/members'
import * as tournamentEnrollmentApi from '../../lib/api/tournamentEnrollment'
import type {
  GetSuggestedCategoryResult,
  GetTournamentResult,
  RegisterResult,
  Registration,
  SuggestedCategory,
  Tournament,
  TournamentCategory,
} from '../../lib/api/tournamentEnrollment'
import { formatBRL } from '../../lib/money'
import { setSessionMemberships } from '../../lib/tenantContext'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import TO4RegisterPage from './TO4RegisterPage'

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  setSessionMemberships([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
})

function category(overrides: Partial<TournamentCategory> = {}): TournamentCategory {
  return {
    id: 'cat-feminina',
    name: 'Feminina B',
    skillTier: 'B',
    genderScope: 'feminino',
    modality: 'duplas',
    maxParticipants: 8,
    ...overrides,
  }
}

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'tour-1',
    name: 'Copa Areia Dourada',
    entryFee: 80,
    categories: [
      category(),
      category({ id: 'cat-mista', name: 'Mista', genderScope: 'misto' }),
      category({ id: 'cat-masculina', name: 'Masculina B', genderScope: 'masculino' }),
    ],
    ...overrides,
  }
}

function tournamentOk(t: Tournament): GetTournamentResult {
  return { ok: true, tournament: t }
}

function suggestionOk(overrides: Partial<SuggestedCategory> = {}): GetSuggestedCategoryResult {
  return {
    ok: true,
    suggestion: {
      categoryId: null,
      categoryName: null,
      reason: 'aluno sem gênero cadastrado',
      ...overrides,
    },
  }
}

function member(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'membership-1',
    user: { id: 'user-carla', name: 'Carla Trindade', email: 'carla@example.com', avatarUrl: null },
    role: { id: 'role-aluno', name: 'Aluno' },
    ...overrides,
  }
}

function registrationOk(overrides: Partial<Registration> = {}): RegisterResult {
  return {
    ok: true,
    registration: {
      id: 'reg-1',
      categoryId: 'cat-feminina',
      player1Id: 'user-self',
      player2Id: null,
      player2ManualName: null,
      player2ManualEmail: null,
      status: 'confirmed',
      invoiceId: null,
      createdAt: '2026-07-23T10:00:00Z',
      ...overrides,
    },
  }
}

function mockGetTournament(result: GetTournamentResult) {
  return vi.spyOn(tournamentEnrollmentApi, 'getTournament').mockResolvedValue(result)
}

function mockGetSuggestedCategory(result: GetSuggestedCategoryResult) {
  return vi.spyOn(tournamentEnrollmentApi, 'getSuggestedCategory').mockResolvedValue(result)
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/tournaments/tour-1/register']}>
      <Routes>
        <Route path="/tournaments/:tournamentId/register" element={<TO4RegisterPage />} />
        <Route path="/tournaments/:tournamentId" element={<div>Tournament view placeholder</div>} />
        <Route path="/invoices/:invoiceId" element={<div>Invoice placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TO4RegisterPage — sugestão de categoria', () => {
  it('pre-selects the suggested category and shows the suggestion hint', async () => {
    mockGetTournament(tournamentOk(tournament()))
    mockGetSuggestedCategory(
      suggestionOk({
        categoryId: 'cat-mista',
        categoryName: 'Mista',
        reason: 'categoria sugerida com base no nível B e gênero cadastrados',
      }),
    )

    renderPage()

    await waitFor(() =>
      expect((screen.getByLabelText('Categoria') as HTMLSelectElement).value).toBe('cat-mista'),
    )
    expect(
      screen.getByText(/Categoria sugerida com base no nível B e gênero cadastrados/),
    ).toBeInTheDocument()
    expect(screen.getByText(/pode trocar livremente/)).toBeInTheDocument()
  })

  it('does not preselect and shows no hint when there is no suggestion', async () => {
    mockGetTournament(tournamentOk(tournament()))
    mockGetSuggestedCategory(
      suggestionOk({ reason: 'aluno sem nível cadastrado no esporte beach_tennis' }),
    )

    renderPage()

    await screen.findByText('Copa Areia Dourada', { exact: false })
    expect((screen.getByLabelText('Categoria') as HTMLSelectElement).value).toBe('cat-feminina')
    expect(screen.queryByText(/pode trocar livremente/)).not.toBeInTheDocument()
  })
})

describe('TO4RegisterPage — parceiro', () => {
  it('searching selects a partner from the platform and submits with player2Id', async () => {
    mockGetTournament(tournamentOk(tournament()))
    mockGetSuggestedCategory(suggestionOk())
    const listSpy = vi
      .spyOn(membersApi, 'listMembers')
      .mockResolvedValue({ ok: true, members: [member()] })
    const registerSpy = vi
      .spyOn(tournamentEnrollmentApi, 'registerForCategory')
      .mockResolvedValue(registrationOk({ player2Id: 'user-carla', status: 'confirmed' }))

    renderPage()
    await screen.findByLabelText('Sua dupla')

    fireEvent.change(screen.getByLabelText('Sua dupla'), { target: { value: 'Carla' } })
    await waitFor(() => expect(listSpy).toHaveBeenCalledWith('unit-1', 'Carla'), { timeout: 1000 })

    fireEvent.click(await screen.findByRole('button', { name: /Carla Trindade/ }))

    // Reskin (Figma 175:2335): o resumo virou uma linha corrida por item
    // ("Dupla: …") em vez de rótulo e valor em colunas opostas.
    expect(screen.getByText('Dupla: Você / Carla Trindade')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Inscrever/ }))

    await waitFor(() =>
      expect(registerSpy).toHaveBeenCalledWith('cat-feminina', { player2Id: 'user-carla' }),
    )
  })

  it('registering a manual partner submits with player2ManualName/player2ManualEmail', async () => {
    mockGetTournament(tournamentOk(tournament()))
    mockGetSuggestedCategory(suggestionOk())
    const registerSpy = vi
      .spyOn(tournamentEnrollmentApi, 'registerForCategory')
      .mockResolvedValue(registrationOk({ status: 'confirmed' }))

    renderPage()
    await screen.findByLabelText('Sua dupla')

    fireEvent.click(screen.getByRole('link', { name: 'Cadastrar parceiro(a) manualmente' }))

    fireEvent.change(screen.getByLabelText('Nome do(a) parceiro(a)'), {
      target: { value: 'Carla Trindade' },
    })
    fireEvent.change(screen.getByLabelText('E-mail do(a) parceiro(a)'), {
      target: { value: 'carla@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Inscrever/ }))

    await waitFor(() =>
      expect(registerSpy).toHaveBeenCalledWith('cat-feminina', {
        player2ManualName: 'Carla Trindade',
        player2ManualEmail: 'carla@example.com',
      }),
    )
  })

  it('hides the partner section entirely for an individual-modality category', async () => {
    mockGetTournament(
      tournamentOk(
        tournament({ categories: [category({ modality: 'individual', genderScope: 'livre' })] }),
      ),
    )
    mockGetSuggestedCategory(suggestionOk())

    renderPage()
    await screen.findByText('Copa Areia Dourada', { exact: false })

    expect(screen.queryByLabelText('Sua dupla')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Inscrever/ })).not.toBeDisabled()
  })
})

describe('TO4RegisterPage — categoria lotada', () => {
  it('shows an error message when the category is full (409 category_full)', async () => {
    mockGetTournament(
      tournamentOk(tournament({ categories: [category({ modality: 'individual' })] })),
    )
    mockGetSuggestedCategory(suggestionOk())
    vi.spyOn(tournamentEnrollmentApi, 'registerForCategory').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'category_full',
      message: 'categoria lotada',
    })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Inscrever/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta categoria está lotada. Escolha outra categoria.',
    )
  })
})

describe('TO4RegisterPage — grátis vs pago', () => {
  it('free tournament: button says "Inscrever", success shows inline confirmation without navigating', async () => {
    mockGetTournament(
      tournamentOk(tournament({ entryFee: 0, categories: [category({ modality: 'individual' })] })),
    )
    mockGetSuggestedCategory(suggestionOk())
    vi.spyOn(tournamentEnrollmentApi, 'registerForCategory').mockResolvedValue(
      registrationOk({ status: 'confirmed', invoiceId: null }),
    )

    renderPage()

    const submitButton = await screen.findByRole('button', { name: 'Inscrever' })
    expect(screen.getByText('Grátis')).toBeInTheDocument()

    fireEvent.click(submitButton)

    expect(await screen.findByRole('status')).toHaveTextContent('Inscrição confirmada')
    expect(screen.queryByText('Invoice placeholder')).not.toBeInTheDocument()
  })

  it('paid tournament: button shows the fee, success navigates to /invoices/:invoiceId', async () => {
    mockGetTournament(
      tournamentOk(
        tournament({ entryFee: 80, categories: [category({ modality: 'individual' })] }),
      ),
    )
    mockGetSuggestedCategory(suggestionOk())
    vi.spyOn(tournamentEnrollmentApi, 'registerForCategory').mockResolvedValue(
      registrationOk({ status: 'pending_payment', invoiceId: 'invoice-1' }),
    )

    renderPage()

    const submitButton = await screen.findByRole('button', {
      name: `Inscrever e pagar — ${formatBRL(80)}`,
    })
    fireEvent.click(submitButton)

    expect(await screen.findByText('Invoice placeholder')).toBeInTheDocument()
  })
})
