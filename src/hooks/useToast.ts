import { useCallback, useState } from 'react'

export type ToastVariant = 'error' | 'success'

/**
 * `variant` (BEAC-1907, T3 — "toast 'Presença registrada!' de sucesso"):
 * aditivo — `showError` continua funcionando exatamente como antes para os
 * chamadores existentes (LoginPage/SignupPage/ResetPassword), variant
 * default 'error' preserva o comportamento anterior sem exigir mudança
 * nesses arquivos.
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const [variant, setVariant] = useState<ToastVariant>('error')

  const showError = useCallback((msg: string) => {
    setVariant('error')
    setMessage(msg)
  }, [])

  const showSuccess = useCallback((msg: string) => {
    setVariant('success')
    setMessage(msg)
  }, [])

  const dismiss = useCallback(() => {
    setMessage(null)
  }, [])

  return { message, variant, showError, showSuccess, dismiss }
}
