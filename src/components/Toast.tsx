// Toast mínimo (BEAC-1816). Não há biblioteca de toast instalada no projeto
// ainda — este é um componente simples e autocontido; se outra story trouxer
// um design system de toasts, este componente pode ser substituído mantendo
// a mesma prop `message`.
export interface ToastProps {
  message: string | null
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  if (!message) return null

  return (
    <div role="alert" className="toast toast--error" onClick={onDismiss}>
      {message}
    </div>
  )
}
