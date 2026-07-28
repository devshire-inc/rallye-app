import { moduleLabel } from '../pages/Roles/moduleCatalog'

/**
 * Módulos elegíveis para D3F com rota real gated por LEITURA em App.tsx
 * (BEAC-2094). `alunos` e `quadras` ficam de fora — nenhum dos dois tem
 * hoje um destino que funcione para quem só tem permissão de `read` (ver
 * memória "Implementation Plan — BEAC-1737/BEAC-2094 D3FDashboard": `alunos`
 * só tem NewStudentPage, gated por `write`; `quadras` não tem nenhuma
 * página construída) — decisão do usuário, não uma escolha silenciosa.
 */
export type D3FEligibleModule =
  | 'professores'
  | 'agenda'
  | 'financeiro'
  | 'torneios'
  | 'config'
  | 'relatorios'

export type D3FModuleAccess = Record<D3FEligibleModule, boolean>

export interface D3FSectionDef {
  module: D3FEligibleModule
  label: string
  path: string
}

const MODULE_ROUTES: { module: D3FEligibleModule; pathFor: (unitId: string) => string }[] = [
  { module: 'agenda', pathFor: (unitId) => `/units/${unitId}/agenda` },
  { module: 'professores', pathFor: (unitId) => `/units/${unitId}/teachers` },
  { module: 'financeiro', pathFor: (unitId) => `/units/${unitId}/cashflow` },
  { module: 'torneios', pathFor: (unitId) => `/units/${unitId}/tournaments` },
  { module: 'relatorios', pathFor: (unitId) => `/units/${unitId}/reports` },
  { module: 'config', pathFor: (unitId) => `/units/${unitId}/settings` },
]

/**
 * Deriva as seções visíveis do D3FDashboard a partir do mapa de acesso
 * (1:1 com `usePermission(modulo,'read')`, BEAC-1737 AC) — esconder sempre,
 * nunca desabilitar: um módulo sem `access[module]` simplesmente não entra
 * no array.
 */
export function visibleD3FSections(access: D3FModuleAccess, unitId: string): D3FSectionDef[] {
  return MODULE_ROUTES.filter((route) => access[route.module]).map((route) => ({
    module: route.module,
    label: moduleLabel(route.module),
    path: route.pathFor(unitId),
  }))
}
