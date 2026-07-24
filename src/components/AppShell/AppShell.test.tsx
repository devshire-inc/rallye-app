import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notificationsApi from '../../lib/api/notifications'
import { AppShell } from './AppShell'

beforeEach(() => {
  // Toda instância de AppShell busca o badge de não lidas ao montar
  // (BEAC-2021) — mockado por padrão pra não vazar `fetch` real nos testes
  // deste arquivo que não testam o badge em si (mesmo raciocínio de
  // S1Page.test.tsx/fetchMePermissions).
  vi.spyOn(notificationsApi, 'getUnreadNotificationCount').mockResolvedValue({
    ok: true,
    unreadCount: 0,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/perfil']}>
      <Routes>
        <Route
          path="/perfil"
          element={
            <AppShell orgLabel="Rede Areia Dourada" userLabel="Dono">
              conteúdo
            </AppShell>
          }
        />
        <Route path="/s1" element={<div>S1 placeholder</div>} />
        <Route path="/notificacoes" element={<div>N1 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Timers reais — ver comentário equivalente em AuthLayout.test.tsx.
describe('AppShell long-press logo (BEAC-1835)', () => {
  it('navigates to /s1 when the sidebar brand mark is held past the long-press delay', async () => {
    const { container } = renderShell()
    const mark = container.querySelector('.brand-mark') as HTMLElement

    fireEvent.pointerDown(mark)

    await waitFor(() => expect(screen.getByText('S1 placeholder')).toBeInTheDocument(), {
      timeout: 1500,
    })
  })

  it('does nothing on a short tap of the brand mark', async () => {
    const { container } = renderShell()
    const mark = container.querySelector('.brand-mark') as HTMLElement

    fireEvent.pointerDown(mark)
    fireEvent.pointerUp(mark)

    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.queryByText('S1 placeholder')).not.toBeInTheDocument()
  })
})

describe('AppShell topbar bell + unread badge (BEAC-2021)', () => {
  it('fetches the unread count on mount and navigates to /notificacoes on bell click', async () => {
    const user = userEvent.setup()
    renderShell()

    const bell = await screen.findByRole('button', { name: /notificações/i })
    await user.click(bell)

    expect(await screen.findByText('N1 placeholder')).toBeInTheDocument()
  })

  it('shows the unread count badge when greater than 0', async () => {
    vi.spyOn(notificationsApi, 'getUnreadNotificationCount').mockResolvedValue({
      ok: true,
      unreadCount: 5,
    })

    renderShell()

    expect(await screen.findByText('5')).toBeInTheDocument()
  })

  it('shows no badge when the unread count is 0', async () => {
    renderShell()

    await screen.findByRole('button', { name: /notificações/i })
    expect(document.querySelector('.shell-bell-badge')).not.toBeInTheDocument()
  })
})
