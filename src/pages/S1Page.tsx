import LogoutButton from '../components/LogoutButton'

/**
 * Placeholder da tela S1 (seleção de membership quando o usuário pertence a
 * 2+ organizações). A tela em si é de outra story/épico — este componente
 * existe apenas como alvo de redirecionamento pós-login para a story
 * BEAC-1674.
 */
export default function S1Page() {
  return (
    <main>
      <h1>Selecione uma organização (S1)</h1>
      <LogoutButton />
    </main>
  )
}
