import { DASHBOARD_PATH } from './redirectTarget'

/**
 * Decide para qual dashboard navegar depois de entrar numa arena (tap num
 * card da S1, ou pulo automático quando há só 1 membership) — D1 Aluno / D2
 * Professor / D3 Admin / OW1 Tenant Owner conforme o role NAQUELA unit
 * (BEAC-1681/1835).
 *
 * Nenhum desses dashboards por role existe de verdade no app ainda (só o
 * `/dashboard` genérico de BEAC-1674/DashboardPage) — o próprio AC de
 * BEAC-1835 permite navegação stub/placeholder nesse caso ("fora de
 * escopo desta task"). Este é o ÚNICO ponto de extensão: quando D1/D2/D3/
 * OW1 existirem, o mapeamento role → path entra aqui, sem tocar em quem
 * chama esta função.
 */
export function dashboardPathForRole(role: string | null): string {
  void role // stub — ver comentário acima; nenhum dashboard por role existe ainda.
  return DASHBOARD_PATH
}
