import type { Membership } from './tenantContext'

/**
 * Decide para onde navegar após uma sessão ser estabelecida (login bem
 * sucedido ou sessão já válida detectada no boot): S1 (seleção de
 * membership) quando o usuário tem 2+ memberships, dashboard direto quando
 * tem só 1. Critério de aceite da story BEAC-1674.
 *
 * Só o length da lista importa aqui — o shape completo da membership
 * (unit_id/tenant_id, BEAC-1680/1832) é irrelevante para esta decisão.
 */
export const S1_PATH = '/s1'
export const DASHBOARD_PATH = '/dashboard'

export function redirectPathForMemberships(memberships: Membership[]): string {
  return memberships.length >= 2 ? S1_PATH : DASHBOARD_PATH
}
