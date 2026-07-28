import { useParams } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { resolveDashboardVariant } from '../lib/dashboardTarget'
import D1Dashboard from './D1Dashboard'
import D2Dashboard from './D2Dashboard'
import D3Dashboard from './D3Dashboard'
import D3FDashboard from './D3FDashboard'
import OW1Dashboard from './OW1Dashboard'
import { PendingApprovalsCard } from './PendingApprovalsCard'
import './DashboardPage.css'

/**
 * Dashboard — dispatcher por variante de papel (BEAC-2092/2093, story
 * BEAC-1736, decisão em memória fd88875b-fa7e-4099-9733-a2ae4b39d783: rota
 * única, sem paths novos). `resolveDashboardVariant` decide qual componente
 * renderizar a partir do `role` bruto de `useShellIdentity`. Todas as 5
 * variantes estão implementadas (D1 Aluno, D2 Professor, D3 Admin, D3F
 * Funcionário/custom role, OW1 Tenant Owner — BEAC-1736/1737/2051); só
 * `GENERIC` (role === null, sem papel atribuído ainda) continua no markup
 * ORIGINAL desta página (`GenericDashboard`, D3 parcial de BEAC-1893:
 * `<h1>Dashboard</h1>` + `PendingApprovalsCard` condicional a `unitId` +
 * `LogoutButton`), preservando o comportamento pré-dispatcher para esse
 * caso. D1/D2/D3/D3F/OW1 resolvem a própria identidade e `unitId`
 * internamente (`GET /me`/`getActiveUnitId()`/`getActiveTenantId()`), sem
 * depender do param de rota — só `GenericDashboard` usa o `:unitId` da URL.
 *
 * Duas rotas apontam pra cá (App.tsx): `/dashboard` (genérico, sem unitId)
 * e `/units/:unitId/dashboard` (BEAC-1893, necessário porque
 * PendingApprovalsCard precisa de um unitId no path).
 */
function GenericDashboard({ unitId }: { unitId: string | undefined }) {
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

export default function DashboardPage() {
  const { unitId } = useParams<{ unitId?: string }>()
  const { role } = useShellIdentity()
  const variant = resolveDashboardVariant(role)

  switch (variant) {
    case 'D1':
      return <D1Dashboard />
    case 'D3F':
      return <D3FDashboard />
    case 'D2':
      return <D2Dashboard />
    case 'D3':
      return <D3Dashboard />
    case 'OW1':
      return <OW1Dashboard />
    case 'GENERIC':
      return <GenericDashboard unitId={unitId} />
  }
}
