/**
 * Formatação compartilhada pelas telas de pedido (26 e 27).
 *
 * Módulo próprio, e não helpers exportados de dentro das páginas, porque um
 * arquivo que exporta componente E função quebra o fast refresh do Vite
 * (`react-refresh/only-export-components`) — o mesmo motivo que separou
 * ./variants.ts do detalhe do produto.
 */
import type { StoreOrder } from '../../lib/api/store'

/** "#0042 · 24/03/2026" — primeira coluna da tabela e topo do card (tela 27). */
export function orderHeadingLabel(order: StoreOrder): string {
  return `${order.numberLabel} · ${formatOrderDate(order.createdAt)}`
}

/** dd/MM/aaaa a partir do RFC3339, fatiando a string em vez de passar por
 * `Date` — mesmo tratamento de `formatDate` em F5MyInvoicesPage, que evita o
 * deslocamento de fuso que `new Date('2026-03-24T…')` introduz. */
function formatOrderDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** "2 itens" / "1 item". `itemCount` conta LINHAS, não a soma das quantidades
 * — mesmo critério do "Carrinho (3 itens)" da tela 24. */
export function itemCountLabel(order: StoreOrder): string {
  return `${order.itemCount} ${order.itemCount === 1 ? 'item' : 'itens'}`
}

/** "Av. Beira-Mar, 1200 — Recife/PE" (telas 25/26), montado sem deixar traço
 * ou barra órfãos quando a arena tem o cadastro incompleto. `null` quando não
 * há endereço nenhum — a tela então mostra só "Retire na recepção", em vez de
 * um bloco vazio. */
export function pickupAddressLabel(pickup: StoreOrder['pickup']): string | null {
  const place = [pickup.city, pickup.state].filter(Boolean).join('/')
  return [pickup.address, place].filter(Boolean).join(' — ') || null
}
