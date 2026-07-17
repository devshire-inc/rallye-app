/**
 * Instância crua do React Context de PermissionsContext (BEAC-1841) — vive
 * num módulo próprio, separado de PermissionsContext.tsx (que só exporta o
 * componente `PermissionsProvider`, exigido pelo eslint
 * react-refresh/only-export-components) e de
 * ../hooks/usePermissionsContext.ts (que só exporta o hook). Não é
 * destinado a ser importado por código de feature — use `usePermission`
 * (../hooks/usePermission.ts) ou `usePermissionsContext`
 * (../hooks/usePermissionsContext.ts).
 */
import { createContext } from 'react'
import type { PermissionsMap } from '../lib/api/permissions'

export type PermissionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; kind: 'full'; permissions: PermissionsMap }
  | { status: 'ready'; kind: 'temporary' }
  | { status: 'error' }

export interface PermissionsContextValue {
  state: PermissionsState
  /** Refaz GET /me/permissions e atualiza o contexto. Quem troca a unit
   * ativa do usuário DEVE chamar isto e aguardar a Promise resolver antes
   * de navegar para qualquer tela da nova unit (AC de BEAC-1841). */
  refetch: () => Promise<void>
}

export const PermissionsContext = createContext<PermissionsContextValue | null>(null)
