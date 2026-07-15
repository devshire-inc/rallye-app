import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import LogoutButton from '../components/LogoutButton'

/**
 * Placeholder da tela S1 (seleção de membership quando o usuário pertence a
 * 2+ organizações). A tela em si é de outra story/épico — este componente
 * existe apenas como alvo de redirecionamento pós-login para a story
 * BEAC-1674. Usa o mesmo shell visual "Horizon" das telas de auth, sem a
 * grade de arenas real (fora do escopo desta story — Épico 3).
 */
export default function S1Page() {
  return (
    <main>
      <AuthLayout
        title="Selecione uma organização (S1)"
        subtitle="Você faz parte destas arenas — toque para entrar."
        mark="sm"
      >
        <LogoutButton />
      </AuthLayout>
    </main>
  )
}
