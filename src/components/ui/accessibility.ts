/**
 * Exige um nome acessível: rótulo visível (`label`, ligado via `htmlFor`) OU
 * `aria-label` standalone — nunca ambos, nunca nenhum.
 */
export type AccessibleLabel =
  { label: string; ariaLabel?: never } | { label?: never; ariaLabel: string }
