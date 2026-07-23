// Agregações puras de F1 (Fluxo de Caixa, BEAC-1946) sobre a lista de
// faturas de um mês (GET /units/{id}/invoices?month=, BEAC-1943) — nenhuma
// chamada de rede aqui, só matemática sobre o que a página já carregou
// (testável sem mock de fetch, mesmo padrão de lib/dashboardTarget.ts).
//
// "Despesas" (AC da story: "lançamentos manuais fora de escopo deste
// épico — gap conhecido, sem tela de lançamento prototipada") NÃO têm
// nenhuma fonte de dado nesta dispatch — sempre 0, nunca um valor
// inventado (ver F1CashFlowPage.tsx pra onde isso é exibido com uma nota
// explicativa).
import type { InvoiceListItem, InvoiceSourceType } from './api/invoices'

export interface CashFlowSummary {
  receita: number
  despesas: number
  saldo: number
}

/** Receita = soma das faturas PAGAS do mês (dinheiro que efetivamente
 * entrou) — mesmo critério do card "Receita" de F1 real. */
export function computeSummary(invoices: InvoiceListItem[]): CashFlowSummary {
  const receita = invoices.filter((i) => i.status === 'paga').reduce((sum, i) => sum + i.amount, 0)
  return { receita, despesas: 0, saldo: receita }
}

export interface RecebimentosSummary {
  recebido: number
  aReceber: number
  emAtraso: number
}

/** "Recebimentos" (F1): recebido (paga), a receber (gerada/enviada, ainda
 * dentro do prazo), em atraso (atrasada). */
export function computeRecebimentos(invoices: InvoiceListItem[]): RecebimentosSummary {
  let recebido = 0
  let aReceber = 0
  let emAtraso = 0
  for (const inv of invoices) {
    if (inv.status === 'paga') recebido += inv.amount
    else if (inv.status === 'atrasada') emAtraso += inv.amount
    else if (inv.status === 'gerada' || inv.status === 'enviada') aReceber += inv.amount
  }
  return { recebido, aReceber, emAtraso }
}

export const SOURCE_TYPE_LABEL: Record<InvoiceSourceType, string> = {
  subscription: 'Mensalidades',
  adhoc: 'Avulso',
  store_order: 'Loja',
  tournament_entry: 'Torneios',
}

export interface CategoryBreakdownEntry {
  sourceType: InvoiceSourceType
  label: string
  amount: number
}

/** Receita por categoria: soma de faturas PAGAS agrupada por source_type —
 * ordenada por valor decrescente (mesmo critério visual do doc real,
 * "ordenadas por valor"). Categorias sem nenhuma fatura paga não aparecem
 * (nunca uma barra de R$0 poluindo a lista). */
export function computeCategoryBreakdown(invoices: InvoiceListItem[]): CategoryBreakdownEntry[] {
  const totals = new Map<InvoiceSourceType, number>()
  for (const inv of invoices) {
    if (inv.status !== 'paga') continue
    totals.set(inv.sourceType, (totals.get(inv.sourceType) ?? 0) + inv.amount)
  }
  return Array.from(totals.entries())
    .map(([sourceType, amount]) => ({ sourceType, label: SOURCE_TYPE_LABEL[sourceType], amount }))
    .sort((a, b) => b.amount - a.amount)
}
