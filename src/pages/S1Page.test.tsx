import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import type { MembershipListItem } from '../lib/api'
import S1Page from './S1Page'

afterEach(() => {
  vi.restoreAllMocks()
})

function membership(overrides: Partial<MembershipListItem> = {}): MembershipListItem {
  return {
    unitId: 'unit-1',
    unit: {
      name: 'Arena Areia Dourada',
      address: 'Florianópolis · SC',
      sportsOffered: ['beach_tennis', 'padel'],
    },
    role: 'Admin',
    lastAccessedAt: null,
    liveActivity: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/s1']}>
      <Routes>
        <Route path="/s1" element={<S1Page />} />
        <Route path="/dashboard" element={<div>Dashboard placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('S1Page — loading', () => {
  it('shows a skeleton of 3 cards while memberships are loading', () => {
    vi.spyOn(api, 'listMyMemberships').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: /carregando arenas/i })).toBeInTheDocument()
  })
})

describe('S1Page — network error', () => {
  it('shows a message and a retry button on failure, and retry reloads successfully', async () => {
    const listSpy = vi
      .spyOn(api, 'listMyMemberships')
      .mockRejectedValueOnce(new api.ListMembershipsError())
      .mockResolvedValueOnce([
        membership(),
        membership({
          unitId: 'unit-2',
          unit: { name: 'Praia Clube', address: null, sportsOffered: [] },
          role: 'Aluno',
        }),
      ])
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText(/não foi possível carregar suas arenas/i)).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: /tentar novamente/i })

    await user.click(retry)

    expect(await screen.findByText('Arena Areia Dourada')).toBeInTheDocument()
    expect(listSpy).toHaveBeenCalledTimes(2)
  })
})

describe('S1Page — 0 memberships', () => {
  it('shows the empty state copy, no cards, and still offers the invite-code entry point', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([])

    renderPage()

    expect(
      await screen.findByText(
        'Você ainda não faz parte de nenhuma arena. Peça ao administrador para te adicionar ou use um código de convite.',
      ),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-arena]')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /entrar em nova arena com código/i }),
    ).toBeInTheDocument()
  })
})

describe('S1Page — exactly 1 membership', () => {
  it('skips the screen and goes straight to the dashboard, marking the membership as accessed', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membership({ unitId: 'unit-only' })])
    const accessSpy = vi.spyOn(api, 'accessMembership').mockResolvedValue(undefined)

    renderPage()

    expect(await screen.findByText('Dashboard placeholder')).toBeInTheDocument()
    expect(accessSpy).toHaveBeenCalledWith('unit-only')
  })

  it('still navigates to the dashboard even if marking as accessed fails (best-effort)', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membership({ unitId: 'unit-only' })])
    vi.spyOn(api, 'accessMembership').mockRejectedValue(new api.AccessMembershipError())

    renderPage()

    expect(await screen.findByText('Dashboard placeholder')).toBeInTheDocument()
  })
})

describe('S1Page — 2+ memberships', () => {
  function twoMemberships() {
    return [
      membership({
        unitId: 'unit-admin',
        unit: {
          name: 'Arena Areia Dourada',
          address: 'Florianópolis · SC',
          sportsOffered: ['beach_tennis', 'padel'],
        },
        role: 'Admin',
      }),
      membership({
        unitId: 'unit-aluno',
        unit: {
          name: 'Praia Clube Ipanema',
          address: 'Rio de Janeiro · RJ',
          sportsOffered: ['volei'],
        },
        role: 'Aluno',
      }),
    ]
  }

  it('renders one card per membership, in the order received, with data-arena/name/city/role badge/sports', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMemberships())

    renderPage()

    const cards = await screen.findAllByRole('button', {
      name: /arena areia dourada|praia clube ipanema/i,
    })
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveAttribute('data-arena', 'unit-admin')
    expect(cards[1]).toHaveAttribute('data-arena', 'unit-aluno')

    expect(screen.getByText('Florianópolis · SC')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Aluno')).toBeInTheDocument()
    expect(screen.getByText('Beach tennis')).toBeInTheDocument()
    expect(screen.getByText('Vôlei')).toBeInTheDocument()
  })

  it('does not render a live-activity indicator when live_activity is null (always the case today)', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMemberships())

    renderPage()

    await screen.findByText('Arena Areia Dourada')
    expect(screen.queryByText(/aulas agora/i)).not.toBeInTheDocument()
  })

  it('tapping a card calls the access endpoint for that unit and navigates to its dashboard', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMemberships())
    const accessSpy = vi.spyOn(api, 'accessMembership').mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderPage()

    const card = await screen.findByRole('button', { name: /praia clube ipanema/i })
    await user.click(card)

    await waitFor(() => expect(accessSpy).toHaveBeenCalledWith('unit-aluno'))
    expect(await screen.findByText('Dashboard placeholder')).toBeInTheDocument()
  })
})

describe('S1Page — "Entrar em nova arena com código" bottom sheet (reuses EnterArenaSheet/BottomSheet, BEAC-1808)', () => {
  it('opens the bottom sheet on trigger click, using the prototype ids (s1Code/s1DialogConfirm)', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([
      membership(),
      membership({
        unitId: 'unit-2',
        unit: {
          name: 'Praia Clube Ipanema',
          address: 'Rio de Janeiro · RJ',
          sportsOffered: ['volei'],
        },
        role: 'Aluno',
      }),
    ])
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Arena Areia Dourada')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /entrar em nova arena com código/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.getElementById('s1Code')).toBeInTheDocument()
    expect(document.getElementById('s1DialogConfirm')).toBeInTheDocument()
  })

  it('closes the sheet, shows an inline confirmation, and refreshes the membership list on successful redemption', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([
      membership(),
      membership({
        unitId: 'unit-2',
        unit: {
          name: 'Praia Clube Ipanema',
          address: 'Rio de Janeiro · RJ',
          sportsOffered: ['volei'],
        },
        role: 'Aluno',
      }),
    ])
    const redeemSpy = vi
      .spyOn(api, 'redeemInvite')
      .mockResolvedValue({ unitId: 'unit-3', roleId: 'role-3' })
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Arena Areia Dourada')
    await user.click(screen.getByRole('button', { name: /entrar em nova arena com código/i }))
    await user.type(screen.getByLabelText(/código do convite/i), 'ABC123')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    expect(await screen.findByText('Você entrou na arena!')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(redeemSpy).toHaveBeenCalledWith('ABC123')
    await waitFor(() => expect(api.listMyMemberships).toHaveBeenCalledTimes(2))
  })

  it('closes the sheet via the backdrop without redeeming anything', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([
      membership(),
      membership({
        unitId: 'unit-2',
        unit: {
          name: 'Praia Clube Ipanema',
          address: 'Rio de Janeiro · RJ',
          sportsOffered: ['volei'],
        },
        role: 'Aluno',
      }),
    ])
    const redeemSpy = vi.spyOn(api, 'redeemInvite')
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Arena Areia Dourada')
    await user.click(screen.getByRole('button', { name: /entrar em nova arena com código/i }))
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    await user.click(backdrop)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(redeemSpy).not.toHaveBeenCalled()
  })
})
