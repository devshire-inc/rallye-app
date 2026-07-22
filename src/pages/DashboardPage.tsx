import { useParams } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import { PendingApprovalsCard } from './PendingApprovalsCard'
import './DashboardPage.css'

/**
 * Dashboard — D3 (Admin) parcial (BEAC-1893, story BEAC-1703). O dashboard
 * admin COMPLETO (stat tiles de inadimplência/turmas, "Ações rápidas" etc.,
 * ver protótipo real) continua fora de escopo — D1/D2/D3/OW1 por role não
 * existem de verdade nesta base (ver comentário de pacote de
 * lib/dashboardTarget.ts). Esta task só adiciona o PRIMEIRO card real: a
 * Central de Pendências.
 *
 * Duas rotas apontam pra cá (App.tsx): `/dashboard` (genérico, sem unitId
 * — alvo de redirect legado de fluxos que ainda não sabem a unit, ex.
 * verificação de e-mail) e `/units/:unitId/dashboard` (BEAC-1893, novo —
 * necessário porque PendingApprovalsCard precisa de um unitId no path para
 * chamar GET /units/{id}/pending-approvals; não existe nenhum mecanismo de
 * "unit ativa" acessível no frontend fora de route params, ver comentário
 * de pacote de lib/redirectTarget.ts). Sem unitId (rota genérica), o card
 * não é renderizado — mesmo comportamento de antes desta story.
 */
export default function DashboardPage() {
  const { unitId } = useParams<{ unitId?: string }>()

  return (
    <main className="dashboard-page">
      <h1>Dashboard</h1>
      {unitId ? (
        <div className="dash-body">
          <PendingApprovalsCard unitId={unitId} />
        </div>
      ) : null}
      <LogoutButton />
    </main>
  )
}
