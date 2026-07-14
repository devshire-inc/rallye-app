import { SocialLoginButtons } from '../components/SocialLoginButtons'
import { Toast } from '../components/Toast'
import { useToast } from '../hooks/useToast'

// A1 — Login. BEAC-1816: por enquanto esta é a única tela de login do
// worktree (BEAC-1674 constrói o restante do formulário de login em um
// worktree isolado em paralelo) — os botões sociais são adicionados aqui
// como o "login/signup component atualmente existente"; a reconciliação
// visual completa de A1 acontece na hora do merge das branches.
export function LoginPage() {
  const { message, showError, dismiss } = useToast()

  return (
    <main className="auth-page" aria-label="Login">
      <h1>Entrar</h1>
      <SocialLoginButtons appleEnabled={false} onError={showError} />
      <Toast message={message} onDismiss={dismiss} />
    </main>
  )
}
