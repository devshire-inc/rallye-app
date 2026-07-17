import { useEffect, useState } from 'react'

/**
 * Devolve `value`, mas atrasado por `delayMs` a partir da última mudança —
 * usado pela busca de MembersPage (BEAC-1845, story BEAC-1686): "busca por
 * nome/e-mail com debounce (mesmo padrão de AL1: 300ms)". 300ms é o valor
 * confirmado no hint-note do protótipo real de AL1 ("Busca com debounce
 * 300ms"), não um número arbitrário — ver comentário de pacote em
 * MembersPage.tsx.
 *
 * Mudanças rápidas sucessivas de `value` reiniciam o timer a cada mudança
 * (mesmo padrão de debounce clássico): só o valor final, `delayMs` depois da
 * ÚLTIMA mudança, é aplicado.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
