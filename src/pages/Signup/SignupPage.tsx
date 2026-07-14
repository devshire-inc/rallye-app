import { useSearchParams } from 'react-router-dom'

/**
 * Stub de A2 (Cadastro) — a tela real vive em outra story/worktree. Existe
 * aqui só para o banner de conversão da sessão temporária (BEAC-1822,
 * "Acesso temporário · Criar conta completa?") ter um destino real,
 * recebendo o e-mail do visitante pré-preenchido via query param.
 */
export function SignupPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') ?? ''

  return (
    <section>
      <h1>Criar conta completa</h1>
      <p>Tela real fora do escopo desta story.</p>
      <label htmlFor="signup-email">E-mail</label>
      <input id="signup-email" type="email" defaultValue={email} readOnly />
    </section>
  )
}
