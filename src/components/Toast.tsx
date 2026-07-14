import type { ToastState } from '../hooks/useToast'

interface ToastProps {
  toast: ToastState | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null

  return (
    <div role="status" aria-live="polite" className="toast">
      {toast.message}
    </div>
  )
}
