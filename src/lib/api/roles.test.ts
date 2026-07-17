import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { createRole, listRoles, patchRole } from './roles'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/roles and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'role-1',
          unit_id: null,
          name: 'Admin',
          is_system_role: true,
          is_custom: false,
          permissions: { config: ['read', 'write'] },
        },
        {
          id: 'role-2',
          unit_id: 'unit-1',
          name: 'Recepção',
          is_system_role: false,
          is_custom: true,
          permissions: { alunos: ['read', 'write'], agenda: ['read'] },
        },
      ]),
    )

    const result = await listRoles('unit-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/roles')
    expect(result).toEqual({
      ok: true,
      roles: [
        {
          id: 'role-1',
          unitId: null,
          name: 'Admin',
          isSystemRole: true,
          isCustom: false,
          permissions: { config: ['read', 'write'] },
        },
        {
          id: 'role-2',
          unitId: 'unit-1',
          name: 'Recepção',
          isSystemRole: false,
          isCustom: true,
          permissions: { alunos: ['read', 'write'], agenda: ['read'] },
        },
      ],
    })
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await listRoles('unit-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})

describe('createRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs to /units/{id}/roles with name + permissions', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, {
        id: 'role-2',
        unit_id: 'unit-1',
        name: 'Recepção',
        is_system_role: false,
        is_custom: true,
        permissions: { alunos: ['read', 'write'] },
      }),
    )

    const result = await createRole('unit-1', {
      name: 'Recepção',
      permissions: { alunos: ['read', 'write'] },
    })

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/roles',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Recepção',
      permissions: { alunos: ['read', 'write'] },
    })
    expect(result).toEqual({
      ok: true,
      role: {
        id: 'role-2',
        unitId: 'unit-1',
        name: 'Recepção',
        isSystemRole: false,
        isCustom: true,
        permissions: { alunos: ['read', 'write'] },
      },
    })
  })

  it('returns ok=false with status on failure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await createRole('unit-1', { name: 'Recepção', permissions: {} })

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})

describe('patchRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /units/{id}/roles/{role_id} with only the provided fields', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'role-2',
        unit_id: 'unit-1',
        name: 'Recepção Sênior',
        is_system_role: false,
        is_custom: true,
        permissions: { agenda: ['read', 'write'] },
      }),
    )

    const result = await patchRole('unit-1', 'role-2', {
      name: 'Recepção Sênior',
      permissions: { agenda: ['read', 'write'] },
    })

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/roles/role-2',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Recepção Sênior',
      permissions: { agenda: ['read', 'write'] },
    })
    expect(result.ok).toBe(true)
  })

  it('returns ok=false with status 403 when the role is a system role (immutable)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'system_role_immutable' }))

    const result = await patchRole('unit-1', 'role-1', { name: 'Novo Nome' })

    expect(result).toEqual({ ok: false, status: 403, error: 'system_role_immutable' })
  })
})
