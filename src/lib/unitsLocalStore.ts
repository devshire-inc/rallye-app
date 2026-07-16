/**
 * GAP CONHECIDO (ver relatório de execução de BEAC-1680/1832): esta story
 * só define POST /tenants/{id}/units (BEAC-1831) — não existe nenhum
 * GET /tenants/{id}/units (nem qualquer outro endpoint) pra listar as units
 * reais de um tenant, muito menos os campos de demonstração do protótipo
 * (contagem de alunos/quadras, receita mensal — dados que não têm schema em
 * lugar nenhum do backend ainda). Adicionar esse endpoint não estava em
 * nenhuma das decisões travadas desta story; construí-lo sem sinal verde
 * seria escopo não autorizado.
 *
 * Por isso OW2 (Minhas unidades) usa este módulo como fonte de dados: uma
 * unit "matriz" semente (dado de demonstração, rotulado como tal na UI —
 * NUNCA apresentado como se viesse do backend) mais qualquer unit criada de
 * fato via OW3 nesta sessão do navegador — essa parte É real: vem direto do
 * `id`/`name` devolvidos pela resposta do POST real (BEAC-1831). Isso é
 * suficiente pro fluxo de verificação manual do AC ("volta pra OW2 com a
 * nova unit na lista"), sem fabricar uma superfície de API nova.
 */
export interface UnitCardData {
  id: string
  name: string
  /** true = dado de demonstração local (nunca veio do backend). */
  isSeed: boolean
}

function storageKey(tenantId: string): string {
  return `rallye:units:${tenantId}`
}

function seedFor(tenantId: string): UnitCardData[] {
  return [{ id: `seed-${tenantId}`, name: 'Unidade Matriz (demonstração)', isSeed: true }]
}

export function loadUnits(tenantId: string): UnitCardData[] {
  if (typeof window === 'undefined') return seedFor(tenantId)
  const raw = window.sessionStorage.getItem(storageKey(tenantId))
  if (!raw) return seedFor(tenantId)
  try {
    const parsed = JSON.parse(raw) as UnitCardData[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedFor(tenantId)
  } catch {
    return seedFor(tenantId)
  }
}

export function appendCreatedUnit(tenantId: string, unit: { id: string; name: string }): void {
  if (typeof window === 'undefined') return
  const current = loadUnits(tenantId)
  const next = [...current, { id: unit.id, name: unit.name, isSeed: false }]
  window.sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
}
