import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as rankingsApi from '../../lib/api/rankings'
import type { RankingEntry } from '../../lib/api/rankings'
import * as meApi from '../../lib/api/me'
import { setSessionMemberships } from '../../lib/tenantContext'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import RankingsPage from './RankingsPage'

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  setSessionMemberships([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'stu-me', fullName: 'Usuária de Teste' })
})

function entry(overrides: Partial<RankingEntry> = {}): RankingEntry {
  return { studentId: 'stu-x', name: 'Jogadora X', totalPoints: 100, ...overrides }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/rankings']}>
      <RankingsPage />
    </MemoryRouter>,
  )
}

describe('RankingsPage — loading and error', () => {
  it('shows a loading status while the ranking is being fetched', () => {
    vi.spyOn(rankingsApi, 'getRankings').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(rankingsApi, 'getRankings').mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

// O reskin (Figma 175:2340 / 187:6805) removeu o pódio de 3 degraus: os três
// primeiros são as três primeiras LINHAS da mesma lista, com medalha no lugar
// do número. Estes testes seguem a lista única.
describe('RankingsPage — list', () => {
  it('renders every place as a row, with a medal for the top 3', async () => {
    vi.spyOn(rankingsApi, 'getRankings').mockResolvedValue({
      ok: true,
      scope: 'arena',
      rankings: [
        entry({ studentId: 'stu-1', name: 'Bia Santos', totalPoints: 850 }),
        entry({ studentId: 'stu-2', name: 'Carla Trindade', totalPoints: 720 }),
        entry({ studentId: 'stu-3', name: 'Duda Melo', totalPoints: 660 }),
        entry({ studentId: 'stu-4', name: 'Lia Renata', totalPoints: 610 }),
      ],
    })

    renderPage()

    const first = await screen.findByTestId('ranking-row-stu-1')
    expect(within(first).getByText('Bia Santos')).toBeInTheDocument()
    expect(within(first).getByText('850 pts')).toBeInTheDocument()
    // `ui/Medal` na variante de posição: o glifo é o desenho e o nome
    // acessível é o ordinal (o emoji sozinho é lido de forma inconsistente).
    expect(within(first).getByRole('img', { name: '1º lugar' })).toBeInTheDocument()
    expect(
      within(screen.getByTestId('ranking-row-stu-3')).getByRole('img', { name: '3º lugar' }),
    ).toBeInTheDocument()

    const row = screen.getByTestId('ranking-row-stu-4')
    expect(within(row).getByText('4')).toBeInTheDocument()
    expect(within(row).getByText('Lia Renata')).toBeInTheDocument()
    expect(within(row).getByText('610 pts')).toBeInTheDocument()
  })

  it('shows the total player count in the footnote', async () => {
    vi.spyOn(rankingsApi, 'getRankings').mockResolvedValue({
      ok: true,
      scope: 'arena',
      rankings: [entry({ studentId: 'stu-1' }), entry({ studentId: 'stu-2' })],
    })

    renderPage()

    expect(await screen.findByText(/2 jogadores? no ranking/i)).toBeInTheDocument()
  })
})

describe('RankingsPage — current user row', () => {
  it('highlights the current user row when inside the visible list', async () => {
    vi.spyOn(rankingsApi, 'getRankings').mockResolvedValue({
      ok: true,
      scope: 'arena',
      rankings: [
        entry({ studentId: 'stu-1', name: 'Bia Santos', totalPoints: 850 }),
        entry({ studentId: 'stu-2', name: 'Carla Trindade', totalPoints: 720 }),
        entry({ studentId: 'stu-3', name: 'Duda Melo', totalPoints: 660 }),
        entry({ studentId: 'stu-me', name: 'Marina Costa', totalPoints: 525 }),
      ],
    })

    renderPage()

    const row = await screen.findByTestId('ranking-row-stu-me')
    expect(within(row).getByText(/você/i)).toBeInTheDocument()
  })

  it('still shows the current user, appended, when they fall outside the top 50', async () => {
    const rankings: RankingEntry[] = Array.from({ length: 60 }, (_, i) =>
      entry({ studentId: `stu-${i + 1}`, name: `Jogadora ${i + 1}`, totalPoints: 1000 - i }),
    )
    rankings[54] = entry({ studentId: 'stu-me', name: 'Marina Costa', totalPoints: 300 })

    vi.spyOn(rankingsApi, 'getRankings').mockResolvedValue({
      ok: true,
      scope: 'arena',
      rankings,
    })

    renderPage()

    await screen.findByTestId('ranking-list')

    const meRow = screen.getByTestId('ranking-row-stu-me')
    expect(within(meRow).getByText('55')).toBeInTheDocument()
    expect(within(meRow).getByText(/você/i)).toBeInTheDocument()
  })
})

describe('RankingsPage — scope tabs', () => {
  it('refetches with scope=nacional when the Nacional tab is selected', async () => {
    const spy = vi
      .spyOn(rankingsApi, 'getRankings')
      .mockResolvedValue({ ok: true, scope: 'arena', rankings: [] })
    const user = userEvent.setup()

    renderPage()
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ scope: 'arena', unitId: 'unit-1' }))

    await user.click(screen.getByRole('tab', { name: 'Nacional' }))

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ scope: 'nacional' }))
  })

  it('leaves Cidade and Estado disabled — the backend has no way to resolve the caller\'s own city/state yet', async () => {
    vi.spyOn(rankingsApi, 'getRankings').mockResolvedValue({ ok: true, scope: 'arena', rankings: [] })

    renderPage()
    await screen.findByRole('tab', { name: 'Cidade' })

    expect(screen.getByRole('tab', { name: 'Cidade' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Estado' })).toBeDisabled()
  })
})
