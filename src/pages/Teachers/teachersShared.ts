import { formatBRL } from '../../lib/money'
import type { RemunerationModel } from '../../lib/api/teachers'

/** Resumo de remuneração de uma linha, mesmo formato do protótipo real
 * (scr-pr1/scr-pr2): "Comissão 30%" / "R$ 80/aula" / "R$ 3.500/mês". */
export function formatRemunerationSummary(model: RemunerationModel, value: number): string {
  switch (model) {
    case 'commission':
      return `Comissão ${value}%`
    case 'per_class':
      return `${formatBRL(value)}/aula`
    case 'fixed':
      return `${formatBRL(value)}/mês`
  }
}
