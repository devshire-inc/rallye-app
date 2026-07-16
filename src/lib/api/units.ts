// Cliente HTTP de POST /tenants/{id}/units (BEAC-1831/1832, story BEAC-1680
// "Criação de Unit adicional em rede existente"). Usa apiFetch (não fetch
// cru) porque este é um endpoint autenticado por sessão — apiFetch injeta o
// cookie/Authorization corretos e aplica o interceptor de refresh-on-401
// (BEAC-1793), mesmo padrão de login/logout/refresh em httpClient.ts.
import { apiFetch } from '../httpClient'

export interface CreateUnitPayload {
  name: string
  address?: string
  phone?: string
  timezone?: string
  sportsOffered?: string[]
  operatingHours?: { summary: string }
}

export interface CreateUnitSuccess {
  ok: true
  id: string
}

export interface CreateUnitFailure {
  ok: false
  status: number
  error: string
}

export type CreateUnitResponse = CreateUnitSuccess | CreateUnitFailure

/**
 * POST /tenants/{tenantId}/units — cria uma Unit adicional na rede do
 * tenant. 403 quando o chamador não é o Tenant Owner daquele tenant
 * (decisão 2 do relatório de execução de BEAC-1680/1831); 404 quando o
 * tenantId não existe/está malformado.
 */
export async function createUnit(
  tenantId: string,
  payload: CreateUnitPayload,
): Promise<CreateUnitResponse> {
  const response = await apiFetch(`/tenants/${tenantId}/units`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      address: payload.address,
      phone: payload.phone,
      timezone: payload.timezone,
      sports_offered: payload.sportsOffered,
      operating_hours: payload.operatingHours,
    }),
  })

  const body = await response.json().catch(() => ({}))

  if (response.ok) {
    return { ok: true, id: body.id }
  }

  return { ok: false, status: response.status, error: body.error ?? 'unknown_error' }
}
