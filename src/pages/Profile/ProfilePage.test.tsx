import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import * as meApi from '../../lib/api/me'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import ProfilePage from './ProfilePage'

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/perfil']}>
      <Routes>
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/configuracoes" element={<div>Configurações placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// BEAC-2035 (story BEAC-1727): "Configurações" no grupo "Conta" deixou de
// ser um MenuRow inerte e passou a apontar pra PF5 (SettingsPage, escopo
// mínimo). "Editar perfil"/"Notificações" continuam inertes de propósito
// (fora de escopo desta task, ver comentário de pacote em ProfilePage.tsx).
describe('ProfilePage — link "Configurações" (BEAC-2035)', () => {
  it('navigates to /configuracoes (PF5)', async () => {
    renderPage()

    await userEvent.click(screen.getByTestId('menu-configuracoes'))

    expect(await screen.findByText('Configurações placeholder')).toBeInTheDocument()
  })

  it('"Editar perfil" and "Notificações" remain inert placeholders', () => {
    renderPage()

    const editar = screen.getByText('Editar perfil').closest('.menu-row')
    const notificacoes = screen.getByText('Notificações').closest('.menu-row')
    expect(editar).toHaveClass('inert')
    expect(notificacoes).toHaveClass('inert')
  })
})

// BEAC-2080 (story BEAC-2057): AppShell mostra orgLabel/userLabel reais via
// useShellIdentity, não mais os literais hardcoded "Arena Areia Dourada"/
// "Perfil" que ProfilePage passava antes.
describe('ProfilePage — AppShell recebe orgLabel/userLabel reais (BEAC-2080)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the real active-unit name and "{full_name} · {roleLabel}" instead of the old hardcoded literals', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'user-1', fullName: 'Ana Beatriz' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([
      {
        unitId: 'unit-1',
        unit: { name: 'Arena Praia Sul', address: null, sportsOffered: null },
        role: 'Aluno',
        lastAccessedAt: null,
        liveActivity: null,
      },
    ])

    const { container } = renderPage()

    await waitFor(() =>
      expect(container.querySelector('.side-foot')).toHaveTextContent('Arena Praia Sul'),
    )
    const sideFoot = container.querySelector('.side-foot')
    expect(sideFoot).toHaveTextContent('Ana Beatriz · Aluno')
    expect(sideFoot).not.toHaveTextContent('Arena Areia Dourada')
    expect(sideFoot).not.toHaveTextContent('Perfil')
  })
})
