import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import * as meApi from '../../lib/api/me'
import * as notificationsApi from '../../lib/api/notifications'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import { AppShellLayout } from './AppShellLayout'

/**
 * Testes da rota de layout — a casca do app.
 *
 * Duas asserções aqui MIGRARAM de testes de página quando o `AppShell` subiu
 * para esta rota, e estão anotadas caso a caso: elas continuavam válidas, só
 * deixaram de pertencer à página que as hospedava.
 */

function mockIdentity(unitName: string, fullName: string, role: string | null) {
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'user-1', fullName })
  vi.spyOn(api, 'listMyMemberships').mockResolvedValue([
    {
      unitId: 'unit-1',
      unit: { name: unitName, address: null, sportsOffered: null },
      role,
      lastAccessedAt: null,
      liveActivity: null,
    },
  ])
}

function renderUnderLayout(initialPath: string) {
  return renderWithPermissions(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShellLayout />}>
          <Route
            path="/units/:unitId/dashboard"
            element={
              <main data-testid="tela-a">
                <Link to="/units/unit-1/agenda">ir para a agenda</Link>
              </main>
            }
          />
          <Route path="/units/:unitId/agenda" element={<main data-testid="tela-b">Agenda</main>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShellLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza a casca uma vez e entrega a tela da rota pelo Outlet', async () => {
    mockIdentity('Arena Praia Sul', 'Ana Beatriz', 'Aluno')

    const { container } = renderUnderLayout('/units/unit-1/dashboard')

    expect(container.querySelectorAll('.app-shell')).toHaveLength(1)
    expect(screen.getByTestId('tela-a')).toBeInTheDocument()
  })

  /**
   * MIGRADA de `src/pages/Profile/ProfilePage.test.tsx` (BEAC-2080, story
   * BEAC-2057). A asserção nunca foi sobre a tela de Perfil — era sobre a
   * casca exibir `orgLabel`/`userLabel` REAIS vindos de `useShellIdentity`,
   * em vez dos literais hardcoded que as páginas passavam antes. Quem deriva
   * esses rótulos hoje é esta rota de layout, então o teste mora aqui.
   */
  it('passa para a casca o orgLabel/userLabel reais de useShellIdentity, nunca literais hardcoded', async () => {
    mockIdentity('Arena Praia Sul', 'Ana Beatriz', 'Aluno')

    const { container } = renderUnderLayout('/units/unit-1/dashboard')

    await waitFor(() =>
      expect(container.querySelector('.sidebar__arena-selector')).toHaveTextContent(
        'Arena Praia Sul',
      ),
    )
    const arenaSelector = container.querySelector('.sidebar__arena-selector')
    expect(arenaSelector).toHaveTextContent('Ana Beatriz · Aluno')
    expect(arenaSelector).not.toHaveTextContent('Arena Areia Dourada')
    expect(arenaSelector).not.toHaveTextContent('Perfil')
  })

  /**
   * A propriedade que esta task inteira existe para entregar, e a versão
   * FORTE da regressão que vivia em `src/pages/DashboardPage.test.tsx`
   * ("a casca sobrevive à transição loading -> variante"): lá o escopo era
   * uma troca de estado DENTRO de uma tela; aqui é a navegação entre duas
   * rotas diferentes, que era exatamente o caso em que a casca remontava.
   *
   * As sondas são nós do DOM: se `.app-shell` e o botão do sino forem os
   * MESMOS objetos antes e depois de navegar, o React reconciliou a casca em
   * vez de desmontá-la — que é a condição para a `transition` do indicador
   * do BottomNav ter de onde partir. O contador de não lidas buscado uma vez
   * só é a consequência observável do mesmo fato.
   */
  it('NÃO remonta a casca ao navegar entre duas rotas do layout', async () => {
    mockIdentity('Arena Praia Sul', 'Ana Beatriz', 'Aluno')
    const unreadCount = vi
      .spyOn(notificationsApi, 'getUnreadNotificationCount')
      .mockResolvedValue({ ok: true, unreadCount: 0 })

    const { container } = renderUnderLayout('/units/unit-1/dashboard')

    const shellAntes = container.querySelector('.app-shell')
    const sinoAntes = await screen.findByRole('button', { name: /notificações/i })
    expect(screen.getByTestId('tela-a')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'ir para a agenda' }))

    expect(await screen.findByTestId('tela-b')).toBeInTheDocument()
    expect(screen.queryByTestId('tela-a')).not.toBeInTheDocument()
    // O miolo trocou; a casca é o mesmo nó.
    expect(container.querySelector('.app-shell')).toBe(shellAntes)
    expect(screen.getByRole('button', { name: /notificações/i })).toBe(sinoAntes)
    await waitFor(() => expect(unreadCount).toHaveBeenCalledTimes(1))
  })

  it('mantém o MESMO nó do BottomNav entre rotas — é o que permite o indicador transicionar', async () => {
    mockIdentity('Arena Praia Sul', 'Ana Beatriz', 'Aluno')

    const { container } = renderUnderLayout('/units/unit-1/dashboard')

    const bottomNavAntes = container.querySelector('.bottom-nav')
    expect(bottomNavAntes).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'ir para a agenda' }))
    await screen.findByTestId('tela-b')

    expect(container.querySelector('.bottom-nav')).toBe(bottomNavAntes)
  })
})
