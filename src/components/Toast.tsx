import './Toast.css'

// Toast mínimo (BEAC-1816). Não há biblioteca de toast instalada no projeto
// ainda — este é um componente simples e autocontido; se outra story trouxer
// um design system de toasts, este componente pode ser substituído mantendo
// a mesma prop `message`.
export interface ToastProps {
  message: string | null
  onDismiss: () => void
  /** BEAC-1907 (T3 — toast "Presença registrada!" de sucesso): default
   * 'error' preserva o visual/comportamento anterior para todo chamador que
   * não passa esta prop (LoginPage/SignupPage/ResetPassword). */
  variant?: 'error' | 'success'
}

export function Toast({ message, onDismiss, variant = 'error' }: ToastProps) {
  if (!message) return null

  return (
    <div role="alert" className={`toast toast--${variant}`} onClick={onDismiss}>
      {message}
    </div>
  )
}
