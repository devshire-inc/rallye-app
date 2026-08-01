import { useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell/AppShell'
import LogoutButton from '../components/LogoutButton'
import { PageLoading } from '../components/ui/PageLoading/PageLoading'
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
 * `GENERIC` (role === null DEPOIS de `loading` resolver — autenticado e sem
 * papel atribuído nesta unit; enquanto carrega quem manda é
 * `DashboardLoading`) continua no markup
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

/**
 * Estado de carregamento do dispatcher — só o MIOLO, sem casca: quem
 * renderiza o `AppShell` é o `DashboardPage` abaixo, uma única vez, tanto
 * durante o carregamento quanto depois. `<main className="dashboard-page">`
 * espelha o que as 5 variantes reais renderizam dentro da casca, então a
 * transição loading -> variante troca só o conteúdo.
 */
function DashboardLoading() {
  return (
    <main className="dashboard-page">
      <PageLoading label="Carregando seu painel" variant="page" />
    </main>
  )
}

/** Miolo da variante resolvida — só o conteúdo, sempre dentro do `AppShell`
 * que `DashboardPage` monta. `GENERIC` é o único caso tratado FORA daqui
 * (ver comentário no `DashboardPage`). */
function DashboardVariant({ role }: { role: string | null }) {
  switch (resolveDashboardVariant(role)) {
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
      return null
  }
}

export default function DashboardPage() {
  const { unitId } = useParams<{ unitId?: string }>()
  const { role, loading, orgLabel, userLabel } = useShellIdentity()

  // `loading` importa porque, sem ele, `role` ainda null durante os fetches
  // cai em GENERIC e TODO usuário vê o dashboard genérico por um instante
  // antes da variante real (o "flash da tela errada"). `GenericDashboard`
  // significa só o que deveria: autenticado, resolvido, e sem papel nesta
  // unit — e continua sendo o ÚNICO caso sem casca (markup pré-dispatcher
  // preservado, ver comentário de pacote acima).
  if (!loading && resolveDashboardVariant(role) === 'GENERIC') {
    return <GenericDashboard unitId={unitId} />
  }

  // O `AppShell` é montado AQUI, uma vez só, e é o MESMO elemento na mesma
  // posição da árvore antes e depois de `loading` resolver — é isso que faz
  // o React reconciliar em vez de desmontar/remontar a casca. Antes, o
  // loading renderizava o próprio `<AppShell>` e cada variante renderizava o
  // dela: como os elementos ficavam em posições diferentes da árvore
  // (`<AppShell>` direto × `<D1Dashboard><AppShell>`), a transição
  // desmontava a casca inteira — a nav piscava e todo efeito de montagem do
  // shell (o `GET /me/notifications/unread-count` do sino) rodava de novo.
  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      {loading ? <DashboardLoading /> : <DashboardVariant role={role} />}
    </AppShell>
  )
}
