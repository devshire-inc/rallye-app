import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import type { MembershipListItem } from '../lib/api'
import * as meApi from '../lib/api/me'
import * as tenantContext from '../lib/tenantContext'
import { useShellIdentity } from './useShellIdentity'

function membershipItem(overrides: Partial<MembershipListItem> = {}): MembershipListItem {
  return {
    unitId: 'unit-1',
    unit: { name: 'Arena Areia Dourada', address: null, sportsOffered: null },
    role: 'Aluno',
    lastAccessedAt: null,
    liveActivity: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useShellIdentity', () => {
  it('builds userLabel with "Aluno" for the Aluno role', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'user-1', fullName: 'Ana Beatriz' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem({ role: 'Aluno' })])
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')

    const { result } = renderHook(() => useShellIdentity())

    await waitFor(() => expect(result.current.userLabel).toBe('Ana Beatriz · Aluno'))
    expect(result.current.orgLabel).toBe('Arena Areia Dourada')
    expect(result.current.role).toBe('Aluno')
  })

  it('builds userLabel with "Professor" for the Professor role', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'user-2', fullName: 'Carlos Souza' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem({ role: 'Professor' })])
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')

    const { result } = renderHook(() => useShellIdentity())

    await waitFor(() => expect(result.current.userLabel).toBe('Carlos Souza · Professor'))
    expect(result.current.role).toBe('Professor')
  })

  it('collapses the admin-tier system roles (Platform Admin/Tenant Owner/Unit Admin) into "Admin"', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'user-3', fullName: 'Rafael Andrade' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem({ role: 'Tenant Owner' })])
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')

    const { result } = renderHook(() => useShellIdentity())

    await waitFor(() => expect(result.current.userLabel).toBe('Rafael Andrade · Admin'))
    // role continua o valor bruto da membership (BEAC-2058 precisa dele pra
    // rotear nav por papel) — só o rótulo exibido em userLabel é colapsado.
    expect(result.current.role).toBe('Tenant Owner')
  })

  it('stays at the empty default (best-effort) when getMe rejects, instead of throwing', async () => {
    vi.spyOn(meApi, 'getMe').mockRejectedValue(new Error('network down'))
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem()])
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')

    const { result } = renderHook(() => useShellIdentity())

    await waitFor(() => {
      // dá tempo pro load() assíncrono rodar; sem asserção específica além
      // de não lançar — o `renderHook` já falharia o teste se a promise
      // rejeitada escapasse como unhandled rejection.
      expect(result.current).toEqual({
        orgLabel: '',
        userLabel: '',
        role: null,
        // erro é um desfecho: sai de "carregando", senão quem despacha por
        // papel (DashboardPage) ficaria num skeleton eterno.
        loading: false,
      })
    })
  })

  it('starts loading and resolves to loading=false on success', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'user-5', fullName: 'Bruno Dias' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem({ role: 'Aluno' })])
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')

    const { result } = renderHook(() => useShellIdentity())

    // primeiro render, antes de qualquer fetch resolver: role null MAS
    // carregando — é o que separa "ainda não sei" de "sem papel".
    expect(result.current).toEqual({ orgLabel: '', userLabel: '', role: null, loading: true })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('Aluno')
  })

  it('resolves to loading=false when getMe answers !ok', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: false, status: 401, error: 'unauthorized' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem()])
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')

    const { result } = renderHook(() => useShellIdentity())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBeNull()
  })

  it('omits the " · {role}" suffix entirely when role is null', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'user-4', fullName: 'Maria Lima' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem({ role: null })])
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')

    const { result } = renderHook(() => useShellIdentity())

    await waitFor(() => expect(result.current.userLabel).toBe('Maria Lima'))
    expect(result.current.userLabel).not.toContain('·')
    expect(result.current.role).toBeNull()
  })
})
