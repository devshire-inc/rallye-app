import { DASHBOARD_PATH } from './redirectTarget'

/**
 * Decide para qual dashboard navegar depois de entrar numa arena (tap num
 * card da S1, ou pulo automático quando há só 1 membership) — D1 Aluno / D2
 * Professor / D3 Admin / OW1 Tenant Owner conforme o role NAQUELA unit
 * (BEAC-1681/1835).
 *
 * D1/D2/OW1 ainda não existem (só o `/dashboard` genérico de
 * BEAC-1674/DashboardPage). D3 passou a existir PARCIALMENTE nesta story
 * (BEAC-1893, card "Central de Pendências") — o dashboard admin completo
 * (stat tiles, ações rápidas etc., ver protótipo real) continua fora de
 * escopo, só o card foi construído. Como o card é gated por PERMISSION
 * (read em agenda OU professores — AC da story), não por nome de role,
 * navegar QUALQUER role para o dashboard unit-scoped é seguro: quem não
 * tiver a permission simplesmente não vê o card (mesmo comportamento do
 * placeholder genérico que já existia). `role` fica sem uso por ora
 * (mantido na assinatura — é o ponto de extensão documentado quando D1/D2/
 * OW1 existirem de verdade e precisarem de paths distintos).
 */
export function dashboardPathForRole(role: string | null, unitId: string | null): string {
  void role
  if (!unitId) return DASHBOARD_PATH
  return `/units/${unitId}/dashboard`
}

export type DashboardVariant = 'D1' | 'D2' | 'D3' | 'D3F' | 'OW1' | 'GENERIC'

const ADMIN_TIER_ROLES = new Set(['Unit Admin', 'Platform Admin'])

/**
 * Decide QUAL componente de dashboard renderizar para um role bruto de
 * useShellIdentity (BEAC-1662, decisão em memória fd88875b-fa7e-4099-9733-
 * a2ae4b39d783). D3F é detectado por EXCLUSÃO (qualquer role não-nulo fora
 * do conjunto de 5 nomes de sistema do seed 000016) — não existe campo de
 * backend para "papel customizado".
 */
export function resolveDashboardVariant(role: string | null): DashboardVariant {
  if (role === null) return 'GENERIC'
  if (role === 'Aluno') return 'D1'
  if (role === 'Professor') return 'D2'
  if (ADMIN_TIER_ROLES.has(role)) return 'D3'
  if (role === 'Tenant Owner') return 'OW1'
  return 'D3F'
}
