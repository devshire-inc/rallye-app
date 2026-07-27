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
/** N1 — Centro de Notificações (BEAC-2021), alcançada pelo sino no topbar de
 * AppShell.tsx a partir de qualquer tela. Vive aqui (não em N1Page.tsx) pra
 * ser importável por AppShell sem depender da página. */
export const N1_PATH = '/notificacoes'

/**
 * BEAC-1893 (Central de Pendências no D3): quando há exatamente 1
 * membership, navega direto para o dashboard UNIT-SCOPED
 * (`/units/{unitId}/dashboard`) em vez do `/dashboard` genérico — D3 (card
 * de Pendências) precisa de um unitId no path pra chamar GET
 * /units/{id}/pending-approvals (não existe nenhum mecanismo de "unit
 * ativa" acessível no frontend fora de route params, ver comentário de
 * pacote de DashboardPage.tsx).
 *
 * Zero memberships (BEAC-2057/2079) vai para S1_PATH, não mais para o
 * `/dashboard` genérico: S1Page já tem um empty-state completo (mensagem +
 * CTA de código de convite) para esse caso, então não há mais motivo para um
 * fallback separado — S1 é o destino único de "usuário sem unit ativa
 * resolvida", com 0 ou 2+ memberships.
 *
 * Recebe só o `unit_id` de cada membership (não o `Membership` completo) —
 * os 3 pontos de entrada que chamam esta função (login, verificação de
 * e-mail, completar-cadastro via convite) usam fontes diferentes
 * (`session.Membership` no login, `GET /me/memberships` nos outros dois),
 * que só têm essa coluna em comum.
 */
export function redirectPathForMemberships(memberships: Pick<Membership, 'unit_id'>[]): string {
  if (memberships.length >= 2) return S1_PATH
  if (memberships.length === 1) return `/units/${memberships[0].unit_id}/dashboard`
  return S1_PATH
}
