import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { TableHeaderCell } from '../../components/ui/TableHeaderCell/TableHeaderCell'
import { TableRow } from '../../components/ui/TableRow/TableRow'
import { getActiveUnitId } from '../../lib/tenantContext'
import type { StoreOrder } from '../../lib/api/store'
import { formatBRL } from '../../lib/money'
import { storeOrdersQueryOptions } from '../../lib/query/store'
import { itemCountLabel, orderHeadingLabel } from './orders'
import { OrderStatusBadge } from './OrderStatusBadge'
import { storeCatalogPath, storeOrderPath } from './routes'
import './Loja.css'

/**
 * 27 — Meus Pedidos. Figma "27 · Loja — Meus Pedidos — Aluno" (node 177:6190
 * mobile / 189:2703 desktop).
 *
 * ## O frame desktop É uma tabela — então esta tela tem dois layouts
 *
 * Ao contrário das telas 22/23/24 desta feature (cards nos dois breakpoints),
 * o frame 189:2703 troca os cards por uma `<table>` de cinco colunas
 * (PEDIDO/ARENA/ITENS/VALOR/STATUS). É o padrão de `F5MyInvoicesPage`, e é
 * dele que esta tela herda o mecanismo: os DOIS layouts ficam no DOM e quem
 * escolhe é uma `@media` em `BREAKPOINT_TABLE_MIN` (1220, ver
 * src/lib/breakpoints.ts) — não `matchMedia`, para não haver flash na
 * primeira pintura nem dependência de stub fora do browser. O
 * `.dash-body--wide` (utilitário global, gatilhado por `:has(table)`) solta o
 * `max-width: 560px` que a coluna carrega por padrão.
 *
 * ## A coluna de ação que o frame não desenha
 *
 * O frame desktop não tem sexta coluna, e a linha inteira NÃO pode virar alvo
 * de clique (regra do DS para `TableRow`: o alvo é sempre o controle dentro da
 * célula, com foco próprio). Ela existe assim mesmo, com cabeçalho só para
 * leitor de tela, porque sem ela **um pedido aguardando pagamento não tem como
 * ser pago**: o caminho até o PIX passa pelo detalhe do pedido, que precisa de
 * um link. Mesma solução, e mesmo motivo, de F5.
 *
 * ## Atravessa arenas
 *
 * `GET /me/store/orders` devolve os pedidos de TODAS as arenas numa consulta
 * (o frame mostra Beira-Mar e Beach Master na mesma lista), já em ordem —
 * mais recentes primeiro. A tela não reordena nem agrupa: a coluna ARENA é o
 * que distingue, exatamente como no frame.
 */
export default function StoreOrdersPage() {
  const navigate = useNavigate()
  const activeUnitId = getActiveUnitId()

  const query = useQuery(storeOrdersQueryOptions())
  const orders = query.data ?? []

  function openOrder(order: StoreOrder) {
    navigate(storeOrderPath(order.id))
  }

  return (
    <>
      <div className="pg-head shop-head">
        <button type="button" className="back shop-back" onClick={() => navigate(-1)}>
          ‹ Voltar
        </button>
      </div>

      <div className="dash-body dash-body--wide shop-body">
        <h1 className="shop-cart-title">Meus Pedidos</h1>

        {query.isPending ? <PageLoading label="Carregando pedidos" variant="list" /> : null}
        {query.isError ? <p role="alert">Não foi possível carregar seus pedidos.</p> : null}

        {query.isSuccess && orders.length === 0 ? (
          <div className="shop-empty">
            <EmptyState
              icon={<span className="shop-empty__glyph">🧾</span>}
              title="Nenhum pedido ainda"
              description="Os pedidos que você fechar na loja aparecem aqui."
              actionLabel={activeUnitId ? 'Ir para a loja' : undefined}
              onAction={activeUnitId ? () => navigate(storeCatalogPath(activeUnitId)) : undefined}
            />
          </div>
        ) : null}

        {orders.length > 0 ? (
          <>
            <div className="shop-orders-cards">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} onOpen={() => openOrder(order)} />
              ))}
            </div>
            <OrdersTable orders={orders} onSelect={openOrder} />
          </>
        ) : null}
      </div>
    </>
  )
}

/**
 * Card do mobile. A borda verde do frame (node 177:6232) marca **só** o pedido
 * pronto para retirada — é o único que pede uma ida à arena, e destacar todos
 * não destacaria nenhum.
 */
function OrderCard({ order, onOpen }: { order: StoreOrder; onOpen: () => void }) {
  const highlighted = order.status === 'pronto'
  return (
    <button
      type="button"
      className={`shop-order-card${highlighted ? ' shop-order-card--ready' : ''}`}
      onClick={onOpen}
    >
      <span className="shop-order-card__heading">{orderHeadingLabel(order)}</span>
      <span className="shop-order-card__arena">{order.unitName}</span>
      <span className="shop-order-card__meta">
        {itemCountLabel(order)} · {formatBRL(order.total)}
      </span>
      <span className="shop-order-card__status">
        <OrderStatusBadge status={order.status} />
      </span>
    </button>
  )
}

function OrdersTable({
  orders,
  onSelect,
}: {
  orders: StoreOrder[]
  onSelect: (order: StoreOrder) => void
}) {
  return (
    <div className="shop-orders-table">
      <table className="shop-orders-table__table">
        {/* O frame não põe título acima da tabela — o h1 "Meus Pedidos" logo
            acima já dá o contexto visual —, mas a tabela precisa de nome
            acessível. */}
        <caption className="shop-sr-only">Meus pedidos</caption>
        <colgroup>
          <col className="shop-orders-table__col--order" />
          <col className="shop-orders-table__col--arena" />
          <col className="shop-orders-table__col--items" />
          <col className="shop-orders-table__col--amount" />
          <col className="shop-orders-table__col--status" />
          <col className="shop-orders-table__col--action" />
        </colgroup>
        <thead>
          <tr>
            <TableHeaderCell>PEDIDO</TableHeaderCell>
            <TableHeaderCell>ARENA</TableHeaderCell>
            <TableHeaderCell>ITENS</TableHeaderCell>
            <TableHeaderCell>VALOR</TableHeaderCell>
            <TableHeaderCell>STATUS</TableHeaderCell>
            <TableHeaderCell>
              <span className="shop-sr-only">Ação</span>
            </TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <td className="shop-orders-table__order">{orderHeadingLabel(order)}</td>
              <td className="shop-orders-table__arena">{order.unitName}</td>
              <td className="shop-orders-table__items">{itemCountLabel(order)}</td>
              <td className="shop-orders-table__amount">{formatBRL(order.total)}</td>
              <td>
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="shop-orders-table__action">
                <Button variant="ghost" size="sm" onClick={() => onSelect(order)}>
                  {order.status === 'aguardando_pagamento' ? 'Pagar agora' : 'Ver ›'}
                  {/* Vírgula e não " — ": o nome acessível apara o espaço das
                      pontas de cada nó e concatena sem separador, então
                      " — #0042" viraria "Ver ›#0042" no leitor de tela.
                      Armadilha já registrada em F5MyInvoicesPage. */}
                  <span className="shop-sr-only">, pedido {order.numberLabel}</span>
                </Button>
              </td>
            </TableRow>
          ))}
        </tbody>
      </table>
    </div>
  )
}
