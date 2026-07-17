import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as rolesApi from '../../lib/api/roles'
import type { Role } from '../../lib/api/roles'
import * as roleAuditApi from '../../lib/api/roleAudit'
import RolesPage from './RolesPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function systemRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'sys-admin',
    unitId: null,
    name: 'Admin',
    isSystemRole: true,
    isCustom: false,
    permissions: { config: ['read', 'write'] },
    ...overrides,
  }
}

function customRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'custom-recepcao',
    unitId: 'unit-1',
    name: 'Recepção',
    isSystemRole: false,
    isCustom: true,
    permissions: { alunos: ['read', 'write'], agenda: ['read'] },
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/roles`]}>
      <Routes>
        <Route path="/units/:unitId/roles" element={<RolesPage />} />
        <Route path="/perfil" element={<div>Perfil placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RolesPage — loading and error', () => {
  it('shows a loading status while roles are being fetched', () => {
    vi.spyOn(rolesApi, 'listRoles').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar os papéis/i,
    )
  })
})

describe('RolesPage — system roles section', () => {
  it('lists system roles with a "Sistema" badge and a permission summary, never clickable', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({
      ok: true,
      roles: [systemRole()],
    })

    renderPage()

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
    // System role row must not be a clickable element (no edit action offered
    // at all — AC: "tocar num papel de sistema não oferece nenhuma ação").
    expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument()
  })
})

describe('RolesPage — custom roles section', () => {
  it('lists custom roles as clickable rows with a readable permission summary', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({
      ok: true,
      roles: [customRole()],
    })

    renderPage()

    const row = await screen.findByRole('button', { name: /recepção/i })
    expect(within(row).getByText(/alunos: ver\/gerenciar/i)).toBeInTheDocument()
    expect(within(row).getByText(/agenda: ver/i)).toBeInTheDocument()
  })

  it('shows a placeholder when there are no custom roles yet', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({
      ok: true,
      roles: [systemRole()],
    })

    renderPage()

    expect(await screen.findByText(/nenhum papel personalizado criado/i)).toBeInTheDocument()
  })
})

describe('RolesPage — creating a custom role', () => {
  it('opens the checklist form from "Criar papel", submits, and reloads the list', async () => {
    const listSpy = vi
      .spyOn(rolesApi, 'listRoles')
      .mockResolvedValueOnce({ ok: true, roles: [systemRole()] })
      .mockResolvedValueOnce({ ok: true, roles: [systemRole(), customRole()] })
    const createSpy = vi.spyOn(rolesApi, 'createRole').mockResolvedValue({
      ok: true,
      role: customRole(),
    })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Admin')

    await user.click(screen.getByRole('button', { name: /criar papel/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/nome do papel/i), 'Recepção')
    // Check "Ver" for alunos and "Editar" for alunos to build a non-empty
    // permissions payload.
    const alunosRow = screen.getByText('Alunos').closest('.role-module-row')
    expect(alunosRow).not.toBeNull()
    await user.click(within(alunosRow as HTMLElement).getByLabelText('Ver'))
    await user.click(within(alunosRow as HTMLElement).getByLabelText('Editar'))

    await user.click(screen.getByRole('button', { name: /^criar papel$/i }))

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    expect(createSpy).toHaveBeenCalledWith('unit-1', {
      name: 'Recepção',
      permissions: { alunos: ['read', 'write'] },
    })
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: /recepção/i })).toBeInTheDocument()
  })
})

describe('RolesPage — editing a custom role', () => {
  it('opens the checklist pre-filled and submits a PATCH with the edited name', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({
      ok: true,
      roles: [systemRole(), customRole()],
    })
    const patchSpy = vi.spyOn(rolesApi, 'patchRole').mockResolvedValue({
      ok: true,
      role: customRole({ name: 'Recepção Sênior' }),
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: /recepção/i }))

    const nameInput = screen.getByLabelText(/nome do papel/i) as HTMLInputElement
    expect(nameInput.value).toBe('Recepção')
    // Pré-preenchido: "Ver" de alunos já deve estar marcado.
    const alunosRow = screen.getByText('Alunos').closest('.role-module-row')
    expect(within(alunosRow as HTMLElement).getByLabelText('Ver')).toBeChecked()
    expect(within(alunosRow as HTMLElement).getByLabelText('Editar')).toBeChecked()

    await user.clear(nameInput)
    await user.type(nameInput, 'Recepção Sênior')
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }))

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1))
    expect(patchSpy).toHaveBeenCalledWith(
      'unit-1',
      'custom-recepcao',
      expect.objectContaining({ name: 'Recepção Sênior' }),
    )
  })
})

describe('RolesPage — tabs', () => {
  it('switches between Papéis and Histórico without breaking the tab structure', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({ ok: true, roles: [systemRole()] })
    vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: true,
      entries: [],
      nextOffset: null,
    })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Admin')

    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: 'Histórico' }))

    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  // Reconciliação do épico: a aba Histórico costumava ser um placeholder
  // morto ("outra story, BEAC-1848") porque BEAC-1687 foi construída num
  // branch isolado, sem visibilidade desta tela. Este teste prova que a
  // integração aconteceu de verdade — RoleAuditPanel renderiza conteúdo
  // real dentro da aba, não o texto placeholder antigo.
  it('renders real RoleAuditPanel content in the Histórico tab, not a stub placeholder', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({ ok: true, roles: [systemRole()] })
    const auditSpy = vi.spyOn(roleAuditApi, 'listRoleAuditLog').mockResolvedValue({
      ok: true,
      entries: [
        {
          id: 'entry-1',
          createdAt: new Date().toISOString(),
          actor: { id: 'user-admin', name: 'Rafael Andrade' },
          target: { id: 'user-target', name: 'Juliana Santos' },
          oldRole: { id: 'role-old', name: 'Estagiária' },
          newRole: { id: 'role-new', name: 'Recepção' },
          text: 'Rafael Andrade alterou o papel de Juliana Santos: Estagiária → Recepção',
        },
      ],
      nextOffset: null,
    })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Admin')

    await user.click(screen.getByRole('tab', { name: 'Histórico' }))

    expect(auditSpy).toHaveBeenCalledWith('unit-1', { limit: 20 })
    expect(
      await screen.findByText(
        'Rafael Andrade alterou o papel de Juliana Santos: Estagiária → Recepção',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/outra story/i)).not.toBeInTheDocument()
  })
})

describe('RolesPage — neutral toast', () => {
  it('renders the exact locked copy about the 9 modules', async () => {
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue({ ok: true, roles: [systemRole()] })

    renderPage()

    expect(
      await screen.findByText(
        'Permissões granulares em 9 módulos: alunos, professores, agenda, financeiro, torneios, loja, config, relatórios e quadras. 1 papel por pessoa por arena.',
      ),
    ).toBeInTheDocument()
  })
})
