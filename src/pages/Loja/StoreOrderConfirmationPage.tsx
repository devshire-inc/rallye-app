import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Icon } from '../../components/ui/Icon/Icon'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getActiveUnitId } from '../../lib/tenantContext'
import { formatBRL } from '../../lib/money'
import { storeFailureOf, storeOrderQueryOptions } from '../../lib/query/store'
import { pickupAddressLabel } from './orders'
import { OrderStatusBadge } from './OrderStatusBadge'
import { invoicePixPath, storeCatalogPath, STORE_ORDERS_PATH } from './routes'
import './Loja.css'

/**
 * 26 — Confirmação de Pedido. Figma "26 · Loja — Confirmação de Pedido —
 * Aluno" (node 177:6132 mobile / 189:2684 desktop).
 *
 * ## É uma ROTA, não um estado de tela
 *
 * `/store/orders/:orderId`, lendo `GET /me/store/orders/{id}`. Poderia ter
 * sido um estado interno do checkout alimentado pelo router `state` (o padrão
 * de `AgendarSucessoPage`), e não foi por uma razão concreta: daqui o usuário
 * SAI para pagar o PIX e VOLTA. Um estado de tela não sobrevive a essa ida e
 * volta; uma rota sobrevive, e ainda relê o pedido no retorno — que é
 * exatamente quando o status muda de "aguardando pagamento" para "preparando".
 *
 * ## O CTA principal segue o status DERIVADO
 *
 * O pedido não tem status de pagamento próprio: quem sabe é a fatura, e o
 * `status` que o backend devolve já resolve isso (`cancelado` > fatura não
 * paga = `aguardando_pagamento` > senão o fulfillment). Então:
 *
 * - `aguardando_pagamento` -> o principal é **PAGAR COM PIX**, apontando para
 *   `/invoices/{invoiceId}/pix` — a tela que já existe. A Loja não emite
 *   cobrança, não faz polling e não conhece QR nenhum; ela passa o
 *   `invoiceId` que o próprio pedido traz e sai da frente. Duplicar aquele
 *   fluxo aqui criaria um segundo lugar para consertar quando houver gateway
 *   de verdade.
 * - pago -> o principal volta a ser **VER MEUS PEDIDOS**, como no frame (que
 *   desenha o pedido já confirmado e por isso não tem botão de pagamento).
 *
 * ## Gaps conhecidos contra o frame (não fabricados)
 *
 * - **"COMO CHEGAR"**: exige mapa/geolocalização. O backend devolve
 *   `pickup.address/city/state` em texto e nada mais — o endereço é exibido,
 *   o botão não é inventado.
 * - O frame chega aqui já pago ("Pedido confirmado!"). Como neste backend a
 *   confirmação do PIX é manual, o caso comum é chegar `aguardando_pagamento`
 *   — o título permanece (o PEDIDO está confirmado; é o pagamento que
 *   falta), e o badge de status diz a verdade sobre o resto.
 */
export default function StoreOrderConfirmationPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const activeUnitId = getActiveUnitId()

  const query = useQuery({
    ...storeOrderQueryOptions(orderId ?? ''),
    enabled: Boolean(orderId),
  })

  const order = query.data ?? null
  const failure = storeFailureOf(query.error)
  const awaitingPayment = order?.status === 'aguardando_pagamento'
  const address = order ? pickupAddressLabel(order.pickup) : null

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="dash-body shop-body">
        {query.isPending ? <PageLoading label="Carregando pedido" variant="section" /> : null}

        {failure?.status === 404 ? (
          <div className="shop-empty">
            <EmptyState
              icon={<span className="shop-empty__glyph">🧾</span>}
              title="Pedido não encontrado"
              description="Este pedido não existe ou não é seu."
              actionLabel="Ver meus pedidos"
              onAction={() => navigate(STORE_ORDERS_PATH)}
            />
          </div>
        ) : query.isError ? (
          <p role="alert">Não foi possível carregar o pedido.</p>
        ) : null}

        {order ? (
          <div className="shop-success">
            {/* Badge concêntrico de "Arena Criada"/"Sucesso"
                (`.unit-success__badge`), replicado com prefixo próprio em
                vez de importado: aquele CSS mora em NewUnitPage.css, que
                esta tela não importa — e importar um CSS de página inteiro
                por três regras traria junto `.two-col`, `.chip-group` e o
                resto do arquivo. */}
            <span className="shop-success__badge" aria-hidden="true">
              <span className="shop-success__badge-inner">
                <Icon name="check" size={32} className="shop-success__icon" />
              </span>
            </span>

            <h1 className="shop-success__title">Pedido confirmado!</h1>
            <p className="shop-success__number">Pedido {order.numberLabel}</p>
            <OrderStatusBadge status={order.status} />

            <div className="shop-success__card">
              <p className="shop-success__arena">
                <span aria-hidden="true">🏟️ </span>
                {order.unitName}
              </p>
              <ul className="shop-success__items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.productName}
                    {item.variantLabel ? ` · ${item.variantLabel}` : ''} ×{item.quantity}
                  </li>
                ))}
              </ul>
              <p className="shop-success__total">Total: {formatBRL(order.total)}</p>
            </div>

            <div className="shop-success__pickup">
              <p className="shop-success__pickup-title">
                <span aria-hidden="true">📍 </span>Retire na recepção
              </p>
              {address ? <p className="shop-success__pickup-line">{address}</p> : null}
            </div>

            <div className="shop-success__actions">
              {awaitingPayment ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => navigate(invoicePixPath(order.invoiceId))}
                >
                  PAGAR COM PIX
                </Button>
              ) : null}

              <Button
                variant={awaitingPayment ? 'secondary' : 'primary'}
                size="lg"
                fullWidth
                onClick={() => navigate(STORE_ORDERS_PATH)}
              >
                VER MEUS PEDIDOS
              </Button>

              {/* Volta para o catálogo da arena DO PEDIDO — é de onde o
                  usuário veio, e ele pode nem ter essa arena como ativa (o
                  carrinho atravessa arenas). */}
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onClick={() => navigate(storeCatalogPath(order.unitId || (activeUnitId ?? '')))}
              >
                CONTINUAR COMPRANDO
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
