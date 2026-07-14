import { useCallback, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  const showError = useCallback((msg: string) => {
    setMessage(msg)
  }, [])

  const dismiss = useCallback(() => {
    setMessage(null)
  }, [])

  return { message, showError, dismiss }
}
