// Helpers puros de exibição de status de fatura (BEAC-1710) — separados dos
// componentes (F2/F3/F5) pra serem testáveis sem precisar renderizar nada,
// mesmo padrão de src/lib/dashboardTarget.ts/src/lib/formatRelativeTimestamp.ts.
import type { InvoiceStatus } from './api/invoices'

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  gerada: 'Gerada',
  enviada: 'Pendente',
  paga: 'Paga',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
}

/** F2/F3 doc: Gerada/Enviada usam badge neutro/warning conforme o estado
 * (Gerada ainda não foi despachada — badge muted; Enviada é a "Pendente"
 * amarela do protótipo). Atrasada é sempre error; Paga sempre success;
 * Cancelada/Estornada neutras/info. */
export function statusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case 'paga':
      return 'badge b-success'
    case 'enviada':
      return 'badge b-warning'
    case 'atrasada':
      return 'badge b-error'
    case 'estornada':
      return 'badge b-info'
    case 'gerada':
    case 'cancelada':
    default:
      return 'badge b-neutral'
  }
}

/** "Pendente" no sentido do F2 (tab "Pendentes") agrupa gerada+enviada —
 * nenhuma das duas é atrasada nem paga. */
export function isPending(status: InvoiceStatus): boolean {
  return status === 'gerada' || status === 'enviada'
}

/** Dias entre hoje e due_date (positivo = no futuro, negativo = já
 * venceu) — usado por F5 ("Vence em 3 dias"/"Atraso: 42 dias"). `today` é
 * injetável em teste (mesmo padrão de src/lib/age.ts). */
export function daysUntilDue(dueDate: string, today: Date = new Date()): number {
  const due = new Date(`${dueDate}T00:00:00Z`)
  const todayUTC = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  const diffMs = due.getTime() - todayUTC.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}
