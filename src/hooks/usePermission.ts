/**
 * usePermission — hook React de verificação de permissão (BEAC-1841, story
 * BEAC-1683). É o próprio mecanismo de UI de permissão do qual todo outro
 * épico/feature do produto depende: qualquer tela que precise mostrar ou
 * esconder um elemento (botão, campo, seção inteira) conforme o role do
 * usuário na unit ativa DEVE usar este hook — nunca reimplementar checagem
 * de role/permission na mão numa tela de feature.
 *
 * ## Padrão de uso obrigatório: "esconder sempre, nunca desabilitar"
 *
 * `usePermission` devolve um `boolean` síncrono, sem nenhuma chamada de
 * rede por invocação (lê do cache já populado por PermissionsContext, ver
 * ../context/PermissionsContext.tsx). O contrato para quem consome:
 *
 * ```tsx
 * function EditarFinanceiroButton() {
 *   const allowed = usePermission('financeiro', 'write')
 *   if (!allowed) return null // NUNCA renderizar um botão desabilitado/cinza
 *   return <button onClick={salvar}>Salvar lançamento</button>
 * }
 * ```
 *
 * Errado (proibido pelo AC desta story):
 * ```tsx
 * const allowed = usePermission('financeiro', 'write')
 * return <button disabled={!allowed}>Salvar lançamento</button> // NÃO FAZER
 * ```
 *
 * Um componente sem a permissão correspondente não deve aparecer "cinza"
 * nem dar qualquer pista visual de que a ação existe — ele simplesmente não
 * é renderizado. Para esconder uma seção inteira (não só um botão), condicione
 * o `return null` no nível mais alto possível daquela seção, pelo mesmo
 * princípio.
 *
 * ## Sessão `type: temporary` (Visitante)
 *
 * `usePermission` sempre devolve `false` para qualquer (module, action) do
 * modelo padrão numa sessão de Visitante — Visitante nunca usa este
 * mecanismo, é autorizado via `scope` diretamente pelo backend (ver
 * api/middleware/authorize.go `scopeMatchesRequest`, rallye-api). Se uma
 * tela precisa saber se está numa sessão de Visitante, use
 * `usePermissionsContext().state` diretamente (./usePermissionsContext.ts)
 * — não infira isso a partir de `usePermission` sempre devolvendo false
 * (que também é o comportamento antes do primeiro fetch completar).
 *
 * ## Antes do primeiro fetch (estado `idle`/`loading`) e em erro de rede
 *
 * `usePermission` devolve `false` — nunca existe um estado "liberado por
 * omissão" enquanto o mapa real de permissions não chegou (mesma postura
 * fail-closed usada em todo o backend desta plataforma).
 */
import type { PermissionAction, PermissionModule } from '../lib/api/permissions'
import { usePermissionsContext } from './usePermissionsContext'

export function usePermission(module: PermissionModule, action: PermissionAction): boolean {
  const { state } = usePermissionsContext()
  if (state.status !== 'ready' || state.kind !== 'full') return false
  return state.permissions[module]?.includes(action) ?? false
}
