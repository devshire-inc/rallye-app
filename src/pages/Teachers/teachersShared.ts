import { formatBRL } from '../../lib/money'
import type { RemunerationModel } from '../../lib/api/teachers'

/** Duas iniciais (primeiro + último nome) para o avatar placeholder — mesma
 * função de StudentProfilePage.tsx (deliberadamente não compartilhada entre
 * páginas de features diferentes, mesma convenção já usada nesta base). */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

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
