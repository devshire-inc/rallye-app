import { useSearchParams } from 'react-router-dom'

/**
 * Stub de A1 (Login) — a tela real nasce em outra story/worktree
 * (BEAC-1674 cobre o BFF, mas a UI de login em si é de outra story).
 * Existe aqui só para a A5 etapa 1 (BEAC-1821) ter um destino real quando o
 * e-mail informado já pertence a uma conta completa ("Você já tem conta!
 * Fazer login?").
 */
export function LoginPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')

  return (
    <section>
      <h1>Login</h1>
      <p>Tela real fora do escopo desta story.</p>
      {email && (
        <p>
          E-mail: <strong>{email}</strong>
        </p>
      )}
    </section>
  )
}
