import { useCallback, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

const DEFAULT_DELAY_MS = 600

export interface LongPressHandlers {
  onPointerDown: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerLeave: (event: PointerEvent) => void
  onPointerCancel: (event: PointerEvent) => void
  /** Evita o menu de contexto nativo (copiar/compartilhar) interromper o
   * gesto de long-press em navegadores mobile. */
  onContextMenu: (event: MouseEvent) => void
}

/**
 * Detecta um gesto de "segurar" (long-press) em qualquer elemento,
 * unificando mouse e touch via Pointer Events (BEAC-1835 — "Acessível via
 * long-press no logo Rallye, de qualquer tela do app").
 *
 * Um toque/clique curto (soltar antes de `delayMs`) não faz nada — só um
 * press sustentado dispara `onLongPress`. `delayMs` default de 600ms segue
 * a mesma ordem de grandeza do long-press nativo do iOS/Android.
 */
export function useLongPress(
  onLongPress: () => void,
  delayMs: number = DEFAULT_DELAY_MS,
): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    clear()
    timerRef.current = setTimeout(onLongPress, delayMs)
  }, [clear, onLongPress, delayMs])

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (event) => event.preventDefault(),
  }
}
