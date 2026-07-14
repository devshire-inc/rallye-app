/**
 * Decide para onde navegar após uma sessão ser estabelecida (login bem
 * sucedido ou sessão já válida detectada no boot): S1 (seleção de
 * membership) quando o usuário tem 2+ memberships, dashboard direto quando
 * tem só 1. Critério de aceite da story BEAC-1674.
 */
export const S1_PATH = '/s1'
export const DASHBOARD_PATH = '/dashboard'

export function redirectPathForMemberships(memberships: string[]): string {
  return memberships.length >= 2 ? S1_PATH : DASHBOARD_PATH
}
