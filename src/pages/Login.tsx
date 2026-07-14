import { Link } from 'react-router-dom'

/**
 * Stub da tela A1 (Login). A A1 real ainda não existe neste worktree — foi
 * construída em outra história/worktree em paralelo (BEAC-1673, branch
 * separada). Este stub existe apenas como destino de redirect após um reset
 * de senha bem-sucedido (A3 etapa 2) e como ponto de entrada para
 * "Esqueci minha senha", seguindo o mesmo padrão adotado por outros
 * executores em histórias paralelas: um placeholder mínimo em vez de
 * bloquear esta história na ausência da tela de login completa.
 */
export function Login() {
  return (
    <section aria-labelledby="login-title">
      <h1 id="login-title">Entrar</h1>
      <p>Tela de login (A1) — em construção em outra história.</p>
      <p>
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
      </p>
    </section>
  )
}
