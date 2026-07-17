/**
 * Escape hatch de baixo nível de PermissionsContext (BEAC-1841): expõe
 * status de loading/error e `refetch()` manual. A maioria das telas de
 * feature só precisa de `usePermission` (./usePermission.ts) — use este
 * hook diretamente só quem precisa disparar um refetch explícito (ex.:
 * S1Page.enterMembership ao trocar de unit ativa, ver comentário de pacote
 * em ../context/PermissionsContext.tsx) ou inspecionar o tipo de sessão
 * (`state.kind === 'temporary'`).
 */
import { useContext } from 'react'
import { PermissionsContext, type PermissionsContextValue } from '../context/permissionsContextInstance'

export function usePermissionsContext(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) {
    throw new Error('usePermissionsContext must be used within a PermissionsProvider')
  }
  return ctx
}
