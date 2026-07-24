import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ProfilePage from './ProfilePage'

function renderPage() {
  return render(
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
