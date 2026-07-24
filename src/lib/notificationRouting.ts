import { getActiveUnitId } from './tenantContext'

/**
 * Resolve o destino de navegação de uma notificação a partir de
 * reference_type/reference_id (BEAC-1723) — usado tanto pelo tap na
 * notificação nativa em background/fechado (src/lib/push.ts, BEAC-2020)
 * quanto pelo tap na lista da Central de Notificações (N1Page, BEAC-2021):
 * uma única fonte de verdade evita as duas ficarem dessincronizadas.
 *
 * Só resolve reference_type cuja rota existente precisa APENAS do próprio
 * id (ex.: /invoices/:invoiceId) — OU de dados já disponíveis no cliente
 * sem precisar que a notificação os carregue (ex.: waitlist_entry usa
 * getActiveUnitId(), mesma derivação de tenantContext.ts já usada por
 * outras rotas unit-scoped, já que o payload da notificação só tem
 * type/reference_type/reference_id, nunca unit_id). Vários outros tipos do
 * doc N1 (booking, pedido, torneio, pendência) apontam para rotas com
 * parâmetros compostos que nem a notificação nem o cliente têm hoje — gap
 * estrutural, não resolvido por esta story: devolve null pra esses, quem
 * chama decide (ex.: só marca como lida, não navega).
 */
export function resolveNotificationRoute(referenceType: string | null | undefined, referenceId: string | null | undefined): string | null {
  if (!referenceType || !referenceId) return null

  switch (referenceType) {
    case 'invoice':
      return `/invoices/${referenceId}`
    case 'waitlist_entry': {
      // AG9 (OfferSheet.tsx, story BEAC-1708), aberto via
      // AG3StudentAgendaPage lendo ?offer=<entryId> (BEAC-1724/BEAC-2023).
      // O Aluno sempre tem exatamente 1 membership relevante — mesma
      // suposição já usada pelo backend (session.Claims.Memberships[0]).
      const unitId = getActiveUnitId()
      return unitId ? `/units/${unitId}/agenda/minha?offer=${referenceId}` : null
    }
    default:
      return null
  }
}
