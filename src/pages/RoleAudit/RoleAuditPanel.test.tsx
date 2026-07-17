import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as roleAuditApi from '../../lib/api/roleAudit'
import type { RoleAuditEntry } from '../../lib/api/roleAudit'
import RoleAuditPanel from './RoleAuditPanel'

afterEach(() => {
  vi.restoreAllMocks()
})

function entry(overrides: Partial<RoleAuditEntry> = {}): RoleAuditEntry {
  return {
    id: 'entry-1',
    createdAt: new Date().toISOString(),
    actor: { id: 'user-admin', name: 'Rafael Andrade' },
    target: { id: 'user-target', name: 'Juliana Santos' },
    oldRole: { id: 'role-old', name: 'Estagiária' },
    newRole: { id: 'role-new', name: 'Recepção' },
    text: 'Rafael Andrade alterou o papel de Juliana Santos: Estagiária → Recepção',
    ...overrides,
  }
}

// Renderiza o painel isolado, sem Router/AppShell — desde a reconciliação
// do épico, RoleAuditPanel é hospedado por RolesPage.tsx (aba "historico"),
// que já tem sua própria cobertura de integração (RolesPage.test.tsx,
// describe "RolesPage — tabs"). Este arquivo cobre só o comportamento do
// painel em si.
function renderPanel(unitId = 'unit-1') {
  return render(<RoleAuditPanel unitId={unitId} />)
}

describe('RoleAuditPanel — loading and error', () => {
  it('shows a loading status while the audit log is being fetched', () => {
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockReturnValue(new Promise(() => {}))

    renderPanel()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar o histórico/i,
    )
  })
})

describe('RoleAuditPanel — context toast (exact prototype copy)', () => {
  it('shows the neutral toast with the exact copy from the real prototype', async () => {
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: true,
      entries: [],
      nextOffset: null,
    })

    renderPanel()

    expect(
      await screen.findByText(
        'Prioridade MVP — rastreabilidade em caso de disputa sobre quem autorizou o quê.',
      ),
    ).toBeInTheDocument()
  })
})

describe('RoleAuditPanel — timeline rendering', () => {
  it('renders each entry with its backend-formatted text and a relative timestamp', async () => {
    const recent = entry({ createdAt: new Date().toISOString() })
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: true,
      entries: [recent],
      nextOffset: null,
    })

    renderPanel()

    expect(
      await screen.findByText(
        'Rafael Andrade alterou o papel de Juliana Santos: Estagiária → Recepção',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/^hoje, \d{2}:\d{2}$/)).toBeInTheDocument()
  })

  it('shows a placeholder when there is no audit history yet', async () => {
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: true,
      entries: [],
      nextOffset: null,
    })

    renderPanel()

    expect(await screen.findByText(/nenhuma mudança de papel registrada/i)).toBeInTheDocument()
  })

  it('never renders any edit/delete affordance — the audit log is immutable', async () => {
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: true,
      entries: [entry()],
      nextOffset: null,
    })

    renderPanel()
    await screen.findByText(/Rafael Andrade alterou o papel de Juliana Santos/)

    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument()
  })
})

describe('RoleAuditPanel — pagination', () => {
  it('shows a "Carregar mais" button when there is a next page, and appends results on click', async () => {
    const listSpy = vi
      .spyOn(roleAuditApi, 'listRoleAuditLog')
      .mockResolvedValueOnce({
        ok: true,
        entries: [entry({ id: 'entry-1' })],
        nextOffset: 20,
      })
      .mockResolvedValueOnce({
        ok: true,
        entries: [
          entry({
            id: 'entry-2',
            text: 'Rafael Andrade atribuiu o papel de Carlos Mendes: Professor',
          }),
        ],
        nextOffset: null,
      })
    const user = userEvent.setup()

    renderPanel()
    await screen.findByText(/Rafael Andrade alterou o papel de Juliana Santos/)

    const loadMore = screen.getByRole('button', { name: /carregar mais/i })
    await user.click(loadMore)

    expect(
      await screen.findByText(/Rafael Andrade atribuiu o papel de Carlos Mendes/),
    ).toBeInTheDocument()
    // Primeira entrada continua visível — carregar mais ANEXA, não substitui.
    expect(screen.getByText(/Rafael Andrade alterou o papel de Juliana Santos/)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument(),
    )

    expect(listSpy).toHaveBeenNthCalledWith(2, 'unit-1', { limit: 20, offset: 20 })
  })

  it('does not show "Carregar mais" when there is no next page', async () => {
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: true,
      entries: [entry()],
      nextOffset: null,
    })

    renderPanel()
    await screen.findByText(/Rafael Andrade alterou o papel de Juliana Santos/)

    expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument()
  })
})
