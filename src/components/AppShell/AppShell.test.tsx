import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePermission } from '../../hooks/usePermission'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import * as notificationsApi from '../../lib/api/notifications'
import { getActiveTenantId, getActiveUnitId } from '../../lib/tenantContext'
import { AppShell } from './AppShell'

vi.mock('../../hooks/usePermission')
vi.mock('../../hooks/useShellIdentity')
vi.mock('../../lib/tenantContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tenantContext')>()
  return { ...actual, getActiveUnitId: vi.fn(), getActiveTenantId: vi.fn() }
})

beforeEach(() => {
  // Toda instância de AppShell busca o badge de não lidas ao montar
  // (BEAC-2021) — mockado por padrão pra não vazar `fetch` real nos testes
  // deste arquivo que não testam o badge em si (mesmo raciocínio de
  // S1Page.test.tsx/fetchMePermissions).
  vi.spyOn(notificationsApi, 'getUnreadNotificationCount').mockResolvedValue({
    ok: true,
    unreadCount: 0,
  })
  // Defaults conservadores (BEAC-2086) — sem unit ativa, sem tenant ativo,
  // sem role, nenhuma permissão: mantém os testes pré-existentes deste
  // arquivo (long-press, bell) passando sem precisar setar estes mocks
  // manualmente, já que eles não exercitam nav real.
  vi.mocked(getActiveUnitId).mockReturnValue(null)
  vi.mocked(getActiveTenantId).mockReturnValue(null)
  vi.mocked(useShellIdentity).mockReturnValue({ orgLabel: '', userLabel: '', role: null, loading: false })
  vi.mocked(usePermission).mockReturnValue(false)
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
    const mark = container.querySelector('.shell-sidebar-logo--pressable') as HTMLElement

    fireEvent.pointerDown(mark)

    await waitFor(() => expect(screen.getByText('S1 placeholder')).toBeInTheDocument(), {
      timeout: 1500,
    })
  })

  it('does nothing on a short tap of the brand mark', async () => {
    const { container } = renderShell()
    const mark = container.querySelector('.shell-sidebar-logo--pressable') as HTMLElement

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

  it('CSS: topbar applies safe-area-inset-top (BEAC-2056)', () => {
    const css = readFileSync('src/components/AppShell/AppShell.css', 'utf8')
    expect(css).toMatch(/env\(safe-area-inset-top/)
  })
})

// Sonda de localização (BEAC-2086): renderizada como filho do AppShell, lê
// useLocation() do mesmo contexto de Router — permite afirmar o path exato
// pós-navegação sem precisar declarar uma <Route> por destino real.
function LocationProbe() {
  const location = useLocation()
  return <span data-testid="probe-path">{location.pathname}</span>
}

// AppShell é montado numa única rota coringa ("*"): toda navegação feita
// via useNavigate() dentro do próprio AppShell apenas troca a location do
// MemoryRouter e re-renderiza o mesmo AppShell (sem remount), o que também
// exercita o cálculo de active-highlight (useLocation) com o path real
// pós-clique.
function renderShellAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <AppShell orgLabel="Org" userLabel="User">
              <LocationProbe />
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function itemsWithLabel(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('.sidebar__item, .bottom-nav__item')).filter(
    (el) => el.textContent === label,
  )
}

// Ambos os componentes reais (`ui/Sidebar`/`ui/BottomNav`) usam a mesma
// convenção BEM de modificador (`--active`), só o nome base do bloco muda.
function activeLabels(container: HTMLElement, selector: '.sidebar__item' | '.bottom-nav__item') {
  const activeSelector =
    selector === '.sidebar__item' ? '.sidebar__item--active' : '.bottom-nav__item--active'
  return Array.from(container.querySelectorAll(activeSelector)).map((el) => el.textContent)
}

describe('AppShell — navegação real dos itens de topo (BEAC-2086)', () => {
  it('Início navega para /units/{unitId}/dashboard quando há unit ativa', async () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    const user = userEvent.setup()
    const { container } = renderShellAt('/perfil')

    await user.click(itemsWithLabel(container, 'Início')[0])

    expect(await screen.findByTestId('probe-path')).toHaveTextContent('/units/unit-1/dashboard')
  })

  it('Início navega para /dashboard (genérico) quando não há unit ativa', async () => {
    const user = userEvent.setup()
    const { container } = renderShellAt('/perfil')

    await user.click(itemsWithLabel(container, 'Início')[0])

    expect(await screen.findByTestId('probe-path')).toHaveTextContent('/dashboard')
  })

  it('Perfil está sempre visível, independente de permissões', () => {
    const { container } = renderShellAt('/dashboard')
    expect(itemsWithLabel(container, 'Perfil')).toHaveLength(2)
  })

  it('"Loja" nunca aparece, mesmo com toda permissão concedida e unit ativa', () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    vi.mocked(usePermission).mockReturnValue(true)
    const { container } = renderShellAt('/perfil')
    expect(itemsWithLabel(container, 'Loja')).toHaveLength(0)
  })

  describe('Agenda', () => {
    it('fica oculta sem agenda:read mesmo com unit ativa', () => {
      vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
      const { container } = renderShellAt('/perfil')
      expect(itemsWithLabel(container, 'Agenda')).toHaveLength(0)
    })

    it('fica oculta sem unit ativa mesmo com agenda:read', () => {
      vi.mocked(usePermission).mockImplementation((module) => module === 'agenda')
      const { container } = renderShellAt('/perfil')
      expect(itemsWithLabel(container, 'Agenda')).toHaveLength(0)
    })

    it.each([
      ['Aluno', '/units/unit-1/agenda/minha'],
      ['Professor', '/units/unit-1/agenda/professor'],
      ['Tenant Owner', '/units/unit-1/agenda'],
      [null, '/units/unit-1/agenda'],
    ] as const)('navega pra rota correta do role %s', async (role, expectedPath) => {
      vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
      vi.mocked(useShellIdentity).mockReturnValue({ orgLabel: '', userLabel: '', role, loading: false })
      vi.mocked(usePermission).mockImplementation((module) => module === 'agenda')
      const user = userEvent.setup()
      const { container } = renderShellAt('/perfil')

      await user.click(itemsWithLabel(container, 'Agenda')[0])

      expect(await screen.findByTestId('probe-path')).toHaveTextContent(expectedPath)
    })
  })

  describe('Torneios', () => {
    it('fica oculta sem torneios:read', () => {
      vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
      const { container } = renderShellAt('/perfil')
      expect(itemsWithLabel(container, 'Torneios')).toHaveLength(0)
    })

    it('navega para /units/{unitId}/tournaments com torneios:read', async () => {
      vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
      vi.mocked(usePermission).mockImplementation((module) => module === 'torneios')
      const user = userEvent.setup()
      const { container } = renderShellAt('/perfil')

      await user.click(itemsWithLabel(container, 'Torneios')[0])

      expect(await screen.findByTestId('probe-path')).toHaveTextContent('/units/unit-1/tournaments')
    })
  })

  describe('Relatórios', () => {
    it('fica oculta sem relatorios:read', () => {
      vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
      const { container } = renderShellAt('/perfil')
      expect(itemsWithLabel(container, 'Relatórios')).toHaveLength(0)
    })

    it('navega para /units/{unitId}/reports com relatorios:read', async () => {
      vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
      vi.mocked(usePermission).mockImplementation((module) => module === 'relatorios')
      const user = userEvent.setup()
      const { container } = renderShellAt('/perfil')

      await user.click(itemsWithLabel(container, 'Relatórios')[0])

      expect(await screen.findByTestId('probe-path')).toHaveTextContent('/units/unit-1/reports')
    })
  })

  it('sem unit ativa resolvível: só Início (genérico) e Perfil aparecem, mesmo com toda permissão concedida', () => {
    vi.mocked(usePermission).mockReturnValue(true)
    const { container } = renderShellAt('/dashboard')

    expect(itemsWithLabel(container, 'Início')).toHaveLength(2)
    expect(itemsWithLabel(container, 'Perfil')).toHaveLength(2)
    expect(itemsWithLabel(container, 'Agenda')).toHaveLength(0)
    expect(itemsWithLabel(container, 'Torneios')).toHaveLength(0)
    expect(itemsWithLabel(container, 'Relatórios')).toHaveLength(0)
  })

  it('só o item cujo path bate (prefix match) com a rota atual mostra o estilo ativo', () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    vi.mocked(usePermission).mockReturnValue(true)
    const { container } = renderShellAt('/units/unit-1/tournaments/new')

    expect(activeLabels(container, '.sidebar__item')).toEqual(['Torneios'])
    expect(activeLabels(container, '.bottom-nav__item')).toEqual(['Torneios'])
  })
})

function subLabelsOf(menu: HTMLElement, itemSelector: string) {
  return Array.from(menu.querySelectorAll(itemSelector)).map((el) => el.textContent)
}

function clickLabel(menu: HTMLElement, itemSelector: string, label: string) {
  const target = Array.from(menu.querySelectorAll(itemSelector)).find((el) => el.textContent === label)
  if (!target) throw new Error(`"${label}" não encontrado em ${itemSelector}`)
  return target as HTMLElement
}

describe('AppShell — menu "Gestão" (BEAC-2087)', () => {
  it('"Gestão" fica oculta sem config:read', () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    vi.mocked(getActiveTenantId).mockReturnValue('tenant-1')
    const { container } = renderShellAt('/perfil')
    expect(itemsWithLabel(container, 'Gestão')).toHaveLength(0)
  })

  it('config:read concedida mas sem unitId/tenantId ativos (0 sub-itens visíveis): "Gestão" fica oculta em vez de abrir vazia', () => {
    vi.mocked(usePermission).mockImplementation((module) => module === 'config')
    // getActiveUnitId()/getActiveTenantId() já são null por padrão (beforeEach) —
    // os 4 sub-itens de Gestão exigem unitId ou tenantId, então nenhum fica
    // visível. Mesmo padrão de Agenda/Torneios/Relatórios: esconder sempre,
    // nunca mostrar um affordance que abre num menu vazio.
    const { container } = renderShellAt('/perfil')
    expect(itemsWithLabel(container, 'Gestão')).toHaveLength(0)
    expect(container.querySelector('.gestao-sheet-wrapper')).not.toBeInTheDocument()
  })

  // Contrato do `ui/Sidebar` real (ver ../ui/Sidebar/Sidebar.tsx): só suporta
  // `sections` fixas, sem item expansível/dropdown. No desktop os 4 destinos
  // de Gestão aparecem direto numa seção "GESTÃO", sem clique extra — o
  // BottomSheet mobile (via BottomNav) é o único lugar que ainda tem o
  // padrão "clicar em Gestão pra revelar os destinos".
  function gestaoSection(container: HTMLElement): HTMLElement {
    return Array.from(container.querySelectorAll('.sidebar__section')).find(
      (el) => el.querySelector('.sidebar__section-label')?.textContent === 'GESTÃO',
    ) as HTMLElement
  }

  it('config:read: os 4 destinos de Gestão aparecem diretos na seção "GESTÃO" da sidebar, cada um navegando pra sua rota real', async () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    vi.mocked(getActiveTenantId).mockReturnValue('tenant-1')
    vi.mocked(usePermission).mockImplementation((module) => module === 'config')
    const user = userEvent.setup()
    const { container } = renderShellAt('/perfil')

    const section = gestaoSection(container)
    expect(section).toBeInTheDocument()
    expect(subLabelsOf(section, '.sidebar__item')).toEqual([
      'Membros',
      'Papéis',
      'Configurações da arena',
      'Minhas unidades',
    ])

    await user.click(clickLabel(section, '.sidebar__item', 'Papéis'))

    expect(await screen.findByTestId('probe-path')).toHaveTextContent('/units/unit-1/roles')
  })

  it('config:read: clicar em "Gestão" (bottomnav) abre o BottomSheet listando os mesmos 4 destinos', async () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    vi.mocked(getActiveTenantId).mockReturnValue('tenant-1')
    vi.mocked(usePermission).mockImplementation((module) => module === 'config')
    const user = userEvent.setup()
    const { container } = renderShellAt('/perfil')

    await user.click(itemsWithLabel(container, 'Gestão')[0])

    const sheet = container.querySelector('.gestao-sheet') as HTMLElement
    expect(sheet).toBeInTheDocument()
    expect(subLabelsOf(sheet, '.gestao-sheet-item')).toEqual([
      'Membros',
      'Papéis',
      'Configurações da arena',
      'Minhas unidades',
    ])

    await user.click(clickLabel(sheet, '.gestao-sheet-item', 'Configurações da arena'))

    expect(await screen.findByTestId('probe-path')).toHaveTextContent('/units/unit-1/settings')
    expect(container.querySelector('.gestao-sheet')).not.toBeInTheDocument()
  })

  it('getActiveTenantId() null: "Minhas unidades" é omitido da seção GESTÃO, os outros 3 continuam', () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    vi.mocked(getActiveTenantId).mockReturnValue(null)
    vi.mocked(usePermission).mockImplementation((module) => module === 'config')
    const { container } = renderShellAt('/perfil')

    const section = gestaoSection(container)
    expect(subLabelsOf(section, '.sidebar__item')).toEqual([
      'Membros',
      'Papéis',
      'Configurações da arena',
    ])
  })

  it('getActiveUnitId() null: só "Minhas unidades" (tenant-scoped) permanece na seção GESTÃO', () => {
    vi.mocked(getActiveUnitId).mockReturnValue(null)
    vi.mocked(getActiveTenantId).mockReturnValue('tenant-1')
    vi.mocked(usePermission).mockImplementation((module) => module === 'config')
    const { container } = renderShellAt('/dashboard')

    const section = gestaoSection(container)
    expect(subLabelsOf(section, '.sidebar__item')).toEqual(['Minhas unidades'])
  })

  it('rota atual bate com um dos 4 sub-destinos: o sub-item correspondente mostra o estilo ativo na sidebar, e "Gestão" no bottomnav', () => {
    vi.mocked(getActiveUnitId).mockReturnValue('unit-1')
    vi.mocked(getActiveTenantId).mockReturnValue('tenant-1')
    vi.mocked(usePermission).mockImplementation((module) => module === 'config')
    const { container } = renderShellAt('/units/unit-1/roles')

    expect(activeLabels(container, '.sidebar__item')).toEqual(['Papéis'])
    expect(activeLabels(container, '.bottom-nav__item')).toEqual(['Gestão'])
  })
})
