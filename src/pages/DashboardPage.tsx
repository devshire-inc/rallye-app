import LogoutButton from '../components/LogoutButton'
import './DashboardPage.css'

/**
 * Placeholder do dashboard (S1/Dashboard são telas de outras stories/épicos
 * — este componente existe apenas como alvo de redirecionamento pós-login
 * para a story BEAC-1674, e para permitir testar o fluxo de logout).
 * Estilização mínima apenas (fonte/fundo consistentes) — o dashboard real é
 * de outro épico.
 */
export default function DashboardPage() {
  return (
    <main className="dashboard-page">
      <h1>Dashboard</h1>
      <LogoutButton />
    </main>
  )
}
