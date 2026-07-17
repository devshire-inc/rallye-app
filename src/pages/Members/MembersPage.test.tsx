import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as membersApi from '../../lib/api/members'
import type { Member } from '../../lib/api/members'
import * as rolesApi from '../../lib/api/roles'
import type { Role } from '../../lib/api/roles'
import MembersPage from './MembersPage'

afterEach(() => {
  vi.restoreAllMocks()
  // Safety net: if a fake-timers test fails/times out before reaching its
  // own vi.useRealTimers() cleanup, fake timers would otherwise leak into
  // every later test in this file (userEvent.click/type hang waiting on a
  // timer that never advances) — always restore real timers here too.
  vi.useRealTimers()
})

function member(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'membership-1',
    user: { id: 'user-1', name: 'Marina Costa', email: null, avatarUrl: null },
    role: { id: 'role-aluno', name: 'Aluno' },
    ...overrides,
  }
}

function systemRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-professor',
    unitId: null,
    name: 'Professor',
    isSystemRole: true,
    isCustom: false,
    permissions: {},
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/members`]}>
      <Routes>
        <Route path="/units/:unitId/members" element={<MembersPage />} />
        <Route path="/perfil" element={<div>Perfil placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MembersPage — loading and error', () => {
  it('shows a loading status while members are being fetched', () => {
    vi.spyOn(membersApi, 'listMembers').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar os membros/i,
    )
  })
})

describe('MembersPage — list rendering (AL1 pattern: avatar/name/role badge)', () => {
  it('renders each member with a 2-letter avatar, name, and current role as a badge', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
      ok: true,
      members: [member()],
    })

    renderPage()

    expect(await screen.findByText('Marina Costa')).toBeInTheDocument()
    expect(screen.getByText('MC')).toBeInTheDocument()
    expect(screen.getByText('Aluno')).toBeInTheDocument()
  })

  it('shows a placeholder when there are no members matching the search', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [] })

    renderPage()

    expect(await screen.findByText(/nenhum membro encontrado/i)).toBeInTheDocument()
  })

  it('renders the member real e-mail as secondary metadata (correction: backend no longer returns null)', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
      ok: true,
      members: [member({ user: { id: 'user-1', name: 'Marina Costa', email: 'marina.costa@example.com', avatarUrl: null } })],
    })

    renderPage()

    expect(await screen.findByText('marina.costa@example.com')).toBeInTheDocument()
  })
})

describe('MembersPage — search with 300ms debounce', () => {
  it('has an accurate placeholder text (name or e-mail — no phone search exists)', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [] })

    renderPage()

    expect(await screen.findByPlaceholderText('Nome ou e-mail...')).toBeInTheDocument()
  })

  it('does not refetch on every keystroke — waits for the debounce before calling the API again', async () => {
    const listSpy = vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
      ok: true,
      members: [],
    })

    renderPage()
    const input = await screen.findByPlaceholderText('Nome ou e-mail...')
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))

    // Fires the underlying onChange 3 times in immediate succession (no
    // userEvent typing delay involved) — a naive "fetch on every change"
    // implementation would call the API 3 more times here.
    fireEvent.change(input, { target: { value: 'm' } })
    fireEvent.change(input, { target: { value: 'ma' } })
    fireEvent.change(input, { target: { value: 'mar' } })

    // Well under the 300ms debounce window: still just the initial mount
    // fetch, none of the 3 changes above triggered a call yet.
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(listSpy).toHaveBeenCalledTimes(1)

    // Past the debounce window: exactly ONE extra call, for the final value.
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2), { timeout: 1000 })
    expect(listSpy).toHaveBeenLastCalledWith('unit-1', 'mar')
  })
})

describe('MembersPage — role assignment', () => {
  it('opens a role picker on tapping a member, applies the pick, and updates the list immediately', async () => {
    const listMembersSpy = vi
      .spyOn(membersApi, 'listMembers')
      .mockResolvedValue({ ok: true, members: [member()] })
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({
      ok: true,
      roles: [systemRole()],
    })
    const patchSpy = vi.spyOn(membersApi, 'patchMemberRole').mockResolvedValue({
      ok: true,
      member: member({ role: { id: 'role-professor', name: 'Professor' } }),
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByTestId('member-row-membership-1'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const option = await screen.findByRole('option', { name: /professor/i })
    await user.click(option)

    await waitFor(() => expect(patchSpy).toHaveBeenCalledWith('unit-1', 'membership-1', 'role-professor'))

    // Sheet closes and the list reflects the new role right away, without a
    // second fetch of the members list (BEAC-1844's contract: PATCH already
    // returns the updated member).
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findAllByText('Professor')).not.toHaveLength(0)
    expect(listMembersSpy).toHaveBeenCalledTimes(1)
  })

  it('offers system roles with a "Sistema" badge in the picker', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [member()] })
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({ ok: true, roles: [systemRole()] })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByTestId('member-row-membership-1'))

    const option = await screen.findByRole('option', { name: /professor/i })
    expect(option).toHaveTextContent('Sistema')
  })
})
