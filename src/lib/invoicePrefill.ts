// Pre-fill de Descrição/Valor por Tipo — F4 (BEAC-1949), tabela da doc real:
//
// | Tipo         | Descrição auto                    | Valor auto        |
// |--------------|------------------------------------|-------------------|
// | Mensalidade  | "Mensalidade {mês} - {plano}"       | Valor do plano    |
// | Pacote       | "Pacote {N} aulas"                   | Valor do pacote   |
// | Torneio      | "Inscrição {nome torneio}"           | Taxa do torneio    |
// | Avulso       | (vazio)                              | (vazio)           |
//
// GAP CONHECIDO (aceito, não inventado — mesmo padrão já usado nesta base
// para dado indisponível, ver TurmasListPage "—/Y alunos"): esta task
// (BEAC-1942, backend) não expõe nenhum endpoint pra descobrir "o plano
// atual do aluno" nem "o torneio ativo" — só source_type=adhoc é criado por
// este endpoint. Por isso o pre-fill de Mensalidade/Pacote/Torneio deixa o
// {plano}/{N aulas}/{nome torneio} em branco pro admin completar (só o
// prefixo textual do template é aplicado) e o Valor fica em branco (0) —
// nunca um valor ou nome inventado. Avulso é o único caso 100% coberto pela
// doc (vazio = vazio).
import type { CreateInvoiceType } from './api/invoices'

export interface InvoicePrefill {
  description: string
  amount: number | null
}

/** monthLabel: "Julho/2026" (mesmo formato usado pelo backend em
 * BEAC-1940, monthYearLabel) — injetável pra ser testável sem Date real. */
export function prefillForType(type: CreateInvoiceType, monthLabel: string): InvoicePrefill {
  switch (type) {
    case 'mensalidade':
      return { description: `Mensalidade ${monthLabel} - `, amount: null }
    case 'pacote':
      return { description: 'Pacote  aulas', amount: null }
    case 'torneio':
      return { description: 'Inscrição ', amount: null }
    case 'avulso':
    default:
      return { description: '', amount: null }
  }
}
