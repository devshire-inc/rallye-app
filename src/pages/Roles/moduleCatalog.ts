import type { RolePermissions } from '../../lib/api/roles'

/**
 * Os 9 módulos de permissão da plataforma (BEAC-1842, mesma matriz de
 * migrations/000016_seed_system_roles.up.sql no rallye-api e do mesmo texto
 * fixo do toast neutro da C3 — "Permissões granulares em 9 módulos: alunos,
 * professores, agenda, financeiro, torneios, loja, config, relatórios e
 * quadras"). `writeVerb` é o verbo usado no resumo de permissões de cada
 * papel personalizado (ver permissionSummary abaixo) — decisão de UI desta
 * task: o backend só modela as ações genéricas `read`/`write`, sem verbo
 * próprio por módulo, então o mapeamento "write -> verbo que soa natural
 * para aquele módulo" (ex.: agenda -> "agendar", loja -> "vender") é feito
 * aqui, no frontend, para o resumo ler como o protótipo real ("alunos:
 * ver/criar · agenda: ver/criar/check-in · 3 módulos" — aproximado, já que
 * esse exemplo do protótipo usa verbos que não mapeiam 1:1 a um modelo
 * binário ver/escrever; a leitura "ver / verbo de escrita" é a
 * generalização mais fiel possível a partir de só duas ações reais).
 */
export interface ModuleDefinition {
  slug: string
  label: string
  writeVerb: string
}

export const MODULE_CATALOG: ModuleDefinition[] = [
  { slug: 'alunos', label: 'Alunos', writeVerb: 'gerenciar' },
  { slug: 'professores', label: 'Professores', writeVerb: 'gerenciar' },
  { slug: 'agenda', label: 'Agenda', writeVerb: 'agendar' },
  { slug: 'financeiro', label: 'Financeiro', writeVerb: 'gerenciar' },
  { slug: 'torneios', label: 'Torneios', writeVerb: 'gerenciar' },
  { slug: 'loja', label: 'Loja', writeVerb: 'vender' },
  { slug: 'config', label: 'Config', writeVerb: 'configurar' },
  { slug: 'relatorios', label: 'Relatórios', writeVerb: 'exportar' },
  { slug: 'quadras', label: 'Quadras', writeVerb: 'gerenciar' },
]

const MODULE_BY_SLUG = new Map(MODULE_CATALOG.map((m) => [m.slug, m]))

function verbsFor(module: ModuleDefinition, actions: string[]): string[] {
  const verbs: string[] = []
  if (actions.includes('read')) verbs.push('ver')
  if (actions.includes('write')) verbs.push(module.writeVerb)
  return verbs
}

/**
 * Resumo legível de um papel a partir de suas permissions (BEAC-1843 AC:
 * "cada linha ... mostra ... um resumo de uma linha das permissões do
 * papel"). Só considera módulos do catálogo com ao menos uma action
 * concedida — mantém a ordem de MODULE_CATALOG (não a ordem de chaves do
 * objeto de entrada, que não é garantida em todo runtime).
 */
export function permissionSummary(permissions: RolePermissions): string {
  const parts: string[] = []
  for (const module of MODULE_CATALOG) {
    const actions = permissions[module.slug]
    if (!actions || actions.length === 0) continue
    const verbs = verbsFor(module, actions)
    if (verbs.length === 0) continue
    parts.push(`${module.slug}: ${verbs.join('/')}`)
  }

  if (parts.length === 0) return 'nenhum módulo liberado'

  const moduleWord = parts.length === 1 ? 'módulo' : 'módulos'
  return `${parts.join(' · ')} · ${parts.length} ${moduleWord}`
}

export function moduleLabel(slug: string): string {
  return MODULE_BY_SLUG.get(slug)?.label ?? slug
}
