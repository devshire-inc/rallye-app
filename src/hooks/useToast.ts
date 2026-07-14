import { useCallback, useEffect, useState } from 'react'

// Toast minimalista, em memória, sem dependência externa: suficiente para o
// requisito "toast 'Senha redefinida!'" da A3 etapa 2 (BEAC-1798). Se o app
// crescer e precisar de toasts empilhados/multi-página, revisitar com uma
// lib dedicada (ex. Sonner) ou um contexto global.

export interface ToastState {
  message: string
  id: number
}

export function useToast(autoDismissMs = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string) => {
    setToast({ message, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), autoDismissMs)
    return () => clearTimeout(timer)
  }, [toast, autoDismissMs])

  return { toast, showToast }
}
