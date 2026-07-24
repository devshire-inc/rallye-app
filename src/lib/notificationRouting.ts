/**
 * Resolve o destino de navegação de uma notificação a partir de
 * reference_type/reference_id (BEAC-1723) — usado tanto pelo tap na
 * notificação nativa em background/fechado (src/lib/push.ts, BEAC-2020)
 * quanto pelo tap na lista da Central de Notificações (N1Page, BEAC-2021):
 * uma única fonte de verdade evita as duas ficarem dessincronizadas.
 *
 * Só resolve reference_type cuja rota existente precisa APENAS do próprio
 * id (ex.: /invoices/:invoiceId). Vários tipos do doc N1 (booking, pedido,
 * torneio, pendência) apontam para rotas com parâmetros compostos (ex.:
 * /units/:unitId/bookings/:bookingId) que a notificação não carrega hoje —
 * gap estrutural, não resolvido por esta story: devolve null pra esses,
 * quem chama decide (ex.: só marca como lida, não navega).
 */
export function resolveNotificationRoute(referenceType: string | null | undefined, referenceId: string | null | undefined): string | null {
  if (!referenceType || !referenceId) return null

  switch (referenceType) {
    case 'invoice':
      return `/invoices/${referenceId}`
    default:
      return null
  }
}
