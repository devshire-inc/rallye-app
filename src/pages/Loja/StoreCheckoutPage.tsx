import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '../../components/AppShell/AppShell'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { createStoreOrder, type CreateStoreOrderFailure, type CartGroup } from '../../lib/api/store'
import { formatBRL } from '../../lib/money'
import { applyCheckoutResult, cartQueryOptions } from '../../lib/query/store'
import { STORE_CART_PATH, storeOrderPath } from './routes'
import './Loja.css'

/** Copy do erro de fechamento por causa. Só o `insufficient_stock` volta com
 * detalhe por produto; os outros dois são estados do carrinho, não do item. */
function checkoutErrorCopy(failure: CreateStoreOrderFailure): {
  title: string
  description: string
} {
  if (failure.error === 'empty_cart') {
    return {
      title: 'Não há mais itens desta arena no carrinho',
      description:
        'O pedido pode já ter sido fechado em outra aba. Confira seus pedidos antes de tentar de novo.',
    }
  }
  if (failure.error === 'insufficient_stock') {
    const lines = failure.stockIssues
      .map(
        (issue) =>
          `${issue.productName}: você pediu ${issue.requested} e restam ${issue.available}`,
      )
      .join('. ')
    return {
      title: 'Estoque insuficiente',
      description: lines
        ? `${lines}. Ajuste as quantidades no carrinho e tente de novo — nada foi cobrado.`
        : 'Algum item saiu de estoque. Ajuste as quantidades no carrinho e tente de novo — nada foi cobrado.',
    }
  }
  if (failure.status === 404) {
    return {
      title: 'Arena indisponível',
      description: 'Não foi possível fechar o pedido nesta arena.',
    }
  }
  return {
    title: 'Não foi possível fechar o pedido',
    description: 'Tente novamente em instantes — nada foi cobrado.',
  }
}

/**
 * 25 — Finalizar Compra. Figma "25 · Loja — Checkout — Aluno" (node 177:6020
 * mobile / 189:2665 desktop).
 *
 * ## UM CHECKOUT É DE UMA ARENA — é o que a rota carrega
 *
 * O carrinho atravessa arenas; o pedido, não. `POST /me/store/orders` recebe
 * `{unit_id}` e fecha **só** aquele grupo, deixando os demais no carrinho — e
 * o frame confirma: a tela 24 somava R$ 536,00 (duas arenas) e esta resume
 * R$ 447,00, os itens da Beira-Mar. Daí `/store/checkout/:unitId`: a arena não
 * é contexto ambiente, é o argumento da operação. A tela lê o grupo
 * correspondente do MESMO cache de carrinho das outras telas
 * (`cartQueryOptions`), sem endpoint novo — não existe "GET checkout".
 *
 * Se o grupo não estiver no carrinho (recarga depois de fechar, ou link
 * antigo), a tela diz isso em vez de mandar um POST que o backend recusaria
 * com `409 empty_cart`.
 *
 * ## O PAGAMENTO É DA FATURA — a Loja não emite cobrança
 *
 * O checkout cria o pedido **e uma fatura** (`source_type='store_order'`), e é
 * a fatura que se paga. O fluxo de PIX já existe inteiro em `PixPaymentPage`
 * (emissão + polling + expiração + honestidade sobre o mock), então nada disso
 * é duplicado aqui: o `CONFIRMAR` cria o pedido e navega para a tela 26, que
 * é quem leva o usuário ao PIX com o `invoiceId` do próprio pedido.
 *
 * Por que 26 no meio, e não direto para o PIX como a linha do frame sugere
 * ("Ao confirmar, você será redirecionado para o pagamento via PIX"): a
 * confirmação do PIX é MANUAL neste backend (não há gateway — um admin
 * registra o pagamento), então ela pode não chegar dentro da sessão. Pular a
 * 26 deixaria o "Pedido confirmado! #0042" — o único comprovante de que o
 * pedido existe, com número, itens e local de retirada — inalcançável no caso
 * comum, e o `‹ Voltar` do PIX cairia neste checkout, cujo grupo o servidor
 * acabou de esvaziar. A 26 é uma rota de verdade (`/store/orders/:id`), então
 * ela sobrevive ao ir e voltar do pagamento. A frase do frame foi ajustada
 * para descrever o que de fato acontece.
 *
 * ## Gap conhecido: o endereço da retirada
 *
 * O frame mostra "Av. Beira-Mar, 1200 — Recife/PE" já aqui. O endereço só
 * existe no backend dentro de `OrderResponse.pickup` — que, por definição, só
 * existe DEPOIS do pedido — e não há endpoint de detalhe de arena acessível ao
 * aluno cross-arena (`units.ts` só tem `createUnit`). Então esta tela nomeia a
 * arena e a forma de retirada, e o endereço completo aparece na tela 26. Um
 * endereço inventado seria pior que um endereço ausente.
 */
export default function StoreCheckoutPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<CreateStoreOrderFailure | null>(null)

  const query = useQuery(cartQueryOptions())
  const group = query.data?.groups.find((candidate) => candidate.unitId === unitId) ?? null

  const checkout = useMutation({
    mutationFn: async () => createStoreOrder(unitId!),
    onSuccess: (result) => {
      if (!result.ok) {
        setFailure(result)
        return
      }
      setFailure(null)
      applyCheckoutResult(queryClient, result.order)
      /* `replace`: o checkout deixou de existir como destino no instante em
         que o servidor esvaziou o grupo. Sem isso, o "voltar" do navegador
         cairia numa tela que só saberia dizer "não há itens desta arena". */
      navigate(storeOrderPath(result.order.id), { replace: true })
    },
    onError: () => setFailure({ ok: false, status: 0, error: 'network_error', stockIssues: [] }),
  })

  const copy = failure ? checkoutErrorCopy(failure) : null

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head shop-head">
        <button type="button" className="back shop-back" onClick={() => navigate(-1)}>
          ‹ Voltar
        </button>
      </div>

      <div className="dash-body shop-body">
        <h1 className="shop-cart-title">Finalizar Compra</h1>

        {query.isPending ? <PageLoading label="Carregando pedido" variant="section" /> : null}
        {query.isError ? <p role="alert">Não foi possível carregar o carrinho.</p> : null}

        {query.isSuccess && group === null ? (
          <div className="shop-empty">
            <EmptyState
              icon={<span className="shop-empty__glyph">🧾</span>}
              title="Nada para fechar aqui"
              description="Não há itens desta arena no seu carrinho."
              actionLabel="Ver carrinho"
              onAction={() => navigate(STORE_CART_PATH)}
            />
          </div>
        ) : null}

        {group ? (
          <>
            {copy ? (
              <AlertCard tone="danger" showIcon>
                <strong>{copy.title}</strong>
                <br />
                {copy.description}
              </AlertCard>
            ) : null}

            <OrderSummary group={group} />

            <h2 className="shop-checkout-section">Retirada</h2>
            <div className="shop-checkout-card shop-checkout-pickup">
              <span className="shop-checkout-pickup__name">
                <span aria-hidden="true">📍 </span>
                {group.unitName}
              </span>
              <span className="shop-checkout-pickup__line">Retirar na recepção</span>
            </div>

            <div className="shop-checkout-card shop-checkout-payment">
              <h2 className="shop-checkout-card__title">Pagamento</h2>
              <p className="shop-checkout-payment__method">
                <span aria-hidden="true">💠 </span>PIX — confirmação instantânea
              </p>
              <div className="shop-checkout-divider" role="presentation" />
              <p className="shop-checkout-total">
                <span>Total</span>
                <span className="shop-checkout-total__value">{formatBRL(group.subtotal)}</span>
              </p>
            </div>

            <p className="shop-checkout-note">
              Ao confirmar, o pedido é criado e você segue para o pagamento via PIX.
            </p>

            {/* `checkoutable: false` = algum item do grupo saiu do catálogo ou
                perdeu estoque. O backend recusaria com 409; a tela para antes
                e diz onde resolver. */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!group.checkoutable || checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? 'CONFIRMANDO…' : `CONFIRMAR — ${formatBRL(group.subtotal)}`}
            </Button>

            {!group.checkoutable ? (
              <p className="shop-checkout-blocked" role="status">
                Há item indisponível neste pedido. Ajuste as quantidades no carrinho para continuar.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

/** "Resumo do Pedido" — as linhas vêm do grupo do carrinho, com o preço lido
 * ao vivo. O valor congelado só passa a existir no pedido, depois do POST. */
function OrderSummary({ group }: { group: CartGroup }) {
  return (
    <div className="shop-checkout-card">
      <h2 className="shop-checkout-card__title">Resumo do Pedido</h2>
      {/* Mesmo tratamento do 🏟️ da tela 24: decorativo, fora do nome. */}
      <p className="shop-checkout-card__arena">
        <span aria-hidden="true">🏟️ </span>
        {group.unitName}
      </p>

      <ul className="shop-checkout-lines">
        {group.items.map((item) => (
          <li key={item.id} className="shop-checkout-line">
            <span className="shop-checkout-line__name">
              {item.productName}
              {item.variantLabel ? ` · ${item.variantLabel}` : ''} ×{item.quantity}
            </span>
            <span className="shop-checkout-line__value">{formatBRL(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <div className="shop-checkout-divider" role="presentation" />
      <p className="shop-checkout-subtotal">
        <span>Subtotal</span>
        <span>{formatBRL(group.subtotal)}</span>
      </p>
    </div>
  )
}
