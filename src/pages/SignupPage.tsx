import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { SocialLoginButtons } from '../components/SocialLoginButtons'
import { Toast } from '../components/Toast'
import { useToast } from '../hooks/useToast'

// A2 — Cadastro. BEAC-1816: a tela de cadastro "real" (BEAC-1788) é
// construída em um worktree isolado em paralelo e não existe ainda neste
// worktree. Esta página é um placeholder mínimo apenas para hospedar os
// botões sociais exigidos pela AC de BEAC-1809 ("botões Google/Apple
// presentes em A1 e A2"); espera-se um follow-up de merge para integrar
// estes botões dentro do componente de cadastro definitivo quando
// BEAC-1788 for mesclada.
export function SignupPage() {
  const { message, showError, dismiss } = useToast()

  return (
    <main aria-label="Cadastro">
      <AuthLayout
        heroTitle="Crie sua conta"
        heroSubtitle="Uma conta só pra todas as arenas do Rallye."
        title="Criar conta"
      >
        <SocialLoginButtons appleEnabled={false} onError={showError} />
      </AuthLayout>
      <Toast message={message} onDismiss={dismiss} />
    </main>
  )
}
