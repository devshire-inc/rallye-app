import { useParams } from 'react-router-dom'
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
 * renderiza o `AppShell` é a rota de layout
 * (../components/AppShell/AppShellLayout.tsx). `<main className="dashboard-page">`
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
 * que a rota de layout monta. `GENERIC` é o único caso tratado FORA daqui
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
  const { role, loading } = useShellIdentity()

  // `loading` importa porque, sem ele, `role` ainda null durante os fetches
  // cai em GENERIC e TODO usuário vê o dashboard genérico por um instante
  // antes da variante real (o "flash da tela errada"). `GenericDashboard`
  // significa só o que deveria: autenticado, resolvido, e sem papel nesta
  // unit.
  //
  // MUDANÇA DE COMPORTAMENTO desta refatoração, a única do refactor: este
  // caso era o ÚNICO sem casca no app inteiro (markup pré-dispatcher
  // preservado). Com a casca numa rota de layout, ela envolve as duas rotas
  // de dashboard e o GENERIC passa a ter nav como qualquer outra tela.
  // Preservar a exceção exigiria ou deixar `/dashboard` fora do layout — e
  // o dashboard é o destino do item "Início" do BottomNav, justamente onde a
  // animação precisa acontecer —, ou um mecanismo de esconder a casca por
  // tela, que não se paga por um caso de borda (autenticado e sem papel
  // NESTA unit). Está documentado no resumo da task para o Bruno decidir se
  // quer de volta.
  if (!loading && resolveDashboardVariant(role) === 'GENERIC') {
    return <GenericDashboard unitId={unitId} />
  }

  // Só o miolo: quem monta a casca é a rota de layout
  // (../components/AppShell/AppShellLayout.tsx). O que este `return` ainda
  // garante é a metade INTERNA da mesma propriedade — `DashboardLoading` e
  // `DashboardVariant` ocupam a mesma posição na árvore, então a transição
  // loading -> variante troca só o conteúdo, sem remontar nada acima.
  return loading ? <DashboardLoading /> : <DashboardVariant role={role} />
}
