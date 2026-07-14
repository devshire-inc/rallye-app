import LogoutButton from '../components/LogoutButton'

/**
 * Placeholder do dashboard (S1/Dashboard são telas de outras stories/épicos
 * — este componente existe apenas como alvo de redirecionamento pós-login
 * para a story BEAC-1674, e para permitir testar o fluxo de logout).
 */
export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <LogoutButton />
    </main>
  )
}
