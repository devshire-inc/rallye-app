import { useParams } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { resolveDashboardVariant } from '../lib/dashboardTarget'
import D1Dashboard from './D1Dashboard'
import D3FDashboard from './D3FDashboard'
import { PendingApprovalsCard } from './PendingApprovalsCard'
import './DashboardPage.css'

/**
 * Dashboard — dispatcher por variante de papel (BEAC-2092/2093, story
 * BEAC-1736, decisão em memória fd88875b-fa7e-4099-9733-a2ae4b39d783: rota
 * única, sem paths novos). `resolveDashboardVariant` decide qual componente
 * renderizar a partir do `role` bruto de `useShellIdentity`; toda variante
 * ainda não implementada (D2/D3/D3F/OW1/GENERIC) cai no markup ORIGINAL
 * desta página (D3 parcial de BEAC-1893: `<h1>Dashboard</h1>` +
 * `PendingApprovalsCard` condicional a `unitId` + `LogoutButton`),
 * preservando 100% do comportamento atual até a story correspondente
 * aterrissar. `D1` (Aluno) é o único caso implementado — `D1Dashboard`
 * resolve o próprio perfil e escopo internamente, sem depender de `unitId`.
 *
 * Duas rotas apontam pra cá (App.tsx): `/dashboard` (genérico, sem unitId)
 * e `/units/:unitId/dashboard` (BEAC-1893, necessário porque
 * PendingApprovalsCard precisa de um unitId no path).
 *
 * `D3F` (BEAC-2094, story BEAC-1737) é o segundo caso implementado —
 * `D3FDashboard` resolve o próprio `unitId` via `getActiveUnitId()`
 * internamente (mesmo padrão de auto-resolução de `D1Dashboard`), não
 * depende do param de rota.
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
    case 'D3':
    case 'OW1':
    case 'GENERIC':
      return <GenericDashboard unitId={unitId} />
  }
}
