import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSelectedUnitId,
  getActiveTenantId,
  getActiveUnitId,
  getRequestUnitId,
  getSessionMemberships,
  setActiveTenantId,
  setSelectedUnitId,
  setSessionMemberships,
} from './tenantContext'

const UNIT_A = '11111111-1111-4111-8111-111111111111'
const UNIT_B = '22222222-2222-4222-8222-222222222222'

describe('tenantContext', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('getActiveTenantId: returns null when there is no session data yet', () => {
    expect(getActiveTenantId()).toBeNull()
  })

  it('getActiveTenantId: derives the tenant id from real session memberships (Tenant Owner, single membership)', () => {
    setSessionMemberships([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])

    expect(getActiveTenantId()).toBe('tenant-1')
  })

  it('getActiveTenantId: derives from the first membership when there are several', () => {
    setSessionMemberships([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-2' },
    ])

    expect(getActiveTenantId()).toBe('tenant-1')
  })

  it('getActiveTenantId: returns null when the session has no memberships', () => {
    setSessionMemberships([])

    expect(getActiveTenantId()).toBeNull()
  })

  it('setActiveTenantId: manual override takes precedence over derived memberships', () => {
    setSessionMemberships([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    setActiveTenantId('tenant-manual')

    expect(getActiveTenantId()).toBe('tenant-manual')
  })

  it('getActiveUnitId: returns null when there is no session data yet', () => {
    expect(getActiveUnitId()).toBeNull()
  })

  it('getActiveUnitId: derives the unit id from the first real session membership', () => {
    setSessionMemberships([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-2' },
    ])

    expect(getActiveUnitId()).toBe('unit-1')
  })

  it('getActiveUnitId: returns null when the session has no memberships', () => {
    setSessionMemberships([])

    expect(getActiveUnitId()).toBeNull()
  })

  it('getSessionMemberships: returns an empty array when there is no session data yet', () => {
    expect(getSessionMemberships()).toEqual([])
  })

  it('getSessionMemberships: returns ALL memberships, not just the first (AG4 cross-arena)', () => {
    setSessionMemberships([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-1' },
    ])

    expect(getSessionMemberships()).toEqual([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-1' },
    ])
  })

  // ---------------------------------------------------------------------
  // Arena da requisição (header X-Rallye-Unit) — ver ./httpClient.ts
  // ---------------------------------------------------------------------

  it('getRequestUnitId: lê a unit da URL /units/{id}/... — a arena da ABA vence tudo', () => {
    setSessionMemberships([
      { unit_id: UNIT_A, tenant_id: 'tenant-1' },
      { unit_id: UNIT_B, tenant_id: 'tenant-2' },
    ])
    setSelectedUnitId(UNIT_A)
    window.history.replaceState({}, '', `/units/${UNIT_B}/dashboard`)

    expect(getRequestUnitId()).toBe(UNIT_B)
  })

  it('getRequestUnitId: sem /units/ na URL, cai na arena selecionada no S1', () => {
    setSelectedUnitId(UNIT_B)
    window.history.replaceState({}, '', '/perfil')

    expect(getRequestUnitId()).toBe(UNIT_B)
  })

  it('getRequestUnitId: sem URL e sem seleção devolve null — nunca chuta uma membership (409 honesto > 403)', () => {
    setSessionMemberships([
      { unit_id: UNIT_A, tenant_id: 'tenant-1' },
      { unit_id: UNIT_B, tenant_id: 'tenant-2' },
    ])
    window.history.replaceState({}, '', '/perfil')

    expect(getRequestUnitId()).toBeNull()
  })

  it('getRequestUnitId: /units/{lixo} devolve null SEM cair na seleção — nunca mistura escopos (path de uma arena, header de outra)', () => {
    setSelectedUnitId(UNIT_A)
    window.history.replaceState({}, '', '/units/nao-e-uuid/dashboard')

    expect(getRequestUnitId()).toBeNull()
  })

  it('getRequestUnitId: /tenants/{id}/units NÃO é rota de arena ativa e não casa com o padrão', () => {
    setSelectedUnitId(UNIT_A)
    window.history.replaceState({}, '', '/tenants/tenant-1/units')

    expect(getRequestUnitId()).toBe(UNIT_A)
  })

  it('clearSelectedUnitId: esquece a seleção (logout) para ela não vazar para a próxima sessão da aba', () => {
    setSelectedUnitId(UNIT_A)
    window.history.replaceState({}, '', '/perfil')
    expect(getRequestUnitId()).toBe(UNIT_A)

    clearSelectedUnitId()

    expect(getRequestUnitId()).toBeNull()
  })

  it('getActiveUnitId (UI): usa a URL antes da primeira membership — um usuário multi-arena em /units/B não vê links da arena A', () => {
    setSessionMemberships([
      { unit_id: UNIT_A, tenant_id: 'tenant-1' },
      { unit_id: UNIT_B, tenant_id: 'tenant-2' },
    ])
    window.history.replaceState({}, '', `/units/${UNIT_B}/agenda`)

    expect(getActiveUnitId()).toBe(UNIT_B)
  })

  it('getActiveUnitId (UI): mantém o fallback histórico da primeira membership quando não há URL nem seleção', () => {
    setSessionMemberships([{ unit_id: UNIT_A, tenant_id: 'tenant-1' }])
    window.history.replaceState({}, '', '/perfil')

    // getRequestUnitId (header) devolve null no mesmo cenário: a UI precisa
    // de um destino para montar links, o header prefere não mandar nada.
    expect(getActiveUnitId()).toBe(UNIT_A)
    expect(getRequestUnitId()).toBeNull()
  })
})
