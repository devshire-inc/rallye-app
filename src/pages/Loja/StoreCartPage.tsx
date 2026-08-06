import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Toast } from '../../components/Toast'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { useCartMutations } from '../../hooks/useCart'
import { useToast } from '../../hooks/useToast'
import { getActiveUnitId } from '../../lib/tenantContext'
import type { CartGroup, CartItem } from '../../lib/api/store'
import { formatBRL } from '../../lib/money'
import { cartQueryOptions } from '../../lib/query/store'
import { storeCatalogPath, storeCheckoutPath } from './routes'
import './Loja.css'

/** Teto do backend por linha de carrinho (`ON CONFLICT DO UPDATE`, faixa
 * 1..99). O "+" para de funcionar aqui em vez de mandar um 400. */
const MAX_QUANTITY = 99

/**
 * 24 — Carrinho. Figma "24 · Loja — Carrinho — Aluno" (node 177:5931 mobile /
 * 189:2646 desktop).
 *
 * ## O carrinho atravessa arenas — e a tela é construída em cima disso
 *
 * O carrinho é objeto do USUÁRIO, não da arena: mora em `/me/store/cart`, não
 * leva `unitId` na rota, e a resposta já vem AGRUPADA por arena. A tela
 * renderiza um grupo por arena (`🏟️ Arena Beira-Mar`), com o aviso
 * "⚠️ Itens de arenas diferentes…" aparecendo só quando `unitCount > 1` — o
 * frame o desenha porque desenha duas arenas, mas com uma só ele seria ruído.
 *
 * Consequência prática que o frame já antecipa e o backend confirma: um
 * checkout fecha UMA arena. Por isso o total do rodapé é o do carrinho
 * inteiro, mas cada grupo carrega o próprio `subtotal` e o próprio
 * `checkoutable` — é neles que o botão de fechar pedido vai se apoiar quando
 * a tela 25 existir (ver "fora de escopo" abaixo).
 *
 * ## Quantidade: PATCH para mudar, DELETE para remover
 *
 * `PATCH` com `quantity: 0` é **400** no backend, de propósito — remover tem
 * seu próprio caminho, e o frame tem um "🗑️ Remover" separado do "−". Então o
 * "−" para em 1 (fica desabilitado) em vez de virar uma remoção silenciosa: o
 * usuário que quer remover clica em remover. Nada aqui traduz um 0 em DELETE
 * por baixo dos panos.
 *
 * As quatro rotas de carrinho devolvem o carrinho INTEIRO, então cada
 * mutação semeia o cache com a resposta (../../hooks/useCart.ts) e a tela —
 * mais o contador do cabeçalho das outras duas — se atualiza sem refetch.
 * Enquanto qualquer mutação está em voo, TODOS os controles ficam
 * desabilitados: as três escrevem no mesmo recurso e duas respostas
 * concorrentes semeariam o mesmo cache fora de ordem.
 *
 * ## `available: false`
 *
 * Um item pode sair do catálogo ou ficar sem estoque para a quantidade
 * pedida DEPOIS de entrar no carrinho (o preço também é lido ao vivo:
 * carrinho é intenção, não documento). A linha continua visível, marcada como
 * indisponível — esconder o item deixaria o usuário sem entender por que o
 * fechamento está bloqueado, e ele precisa poder removê-la.
 *
 * ## "FINALIZAR COMPRA" — um botão por arena, não um por carrinho
 *
 * O checkout (tela 25) existe, e fecha UMA arena por vez. Com um grupo só, o
 * botão do rodapé do frame vale como está e leva a
 * `/store/checkout/{unitId}`. Com mais de um, um único botão de rodapé teria
 * de escolher a arena sozinho — então o CTA desce para dentro de cada grupo,
 * nomeando arena e subtotal, e o rodapé fica só com a explicação. O aviso de
 * arenas diferentes que já estava aqui é exatamente o que torna isso legível.
 *
 * Em qualquer dos dois casos o botão respeita o `checkoutable` do GRUPO: com
 * um item indisponível o backend recusaria o fechamento, e a tela para antes.
 */
export default function StoreCartPage() {
  const navigate = useNavigate()
  const query = useQuery(cartQueryOptions())
  const { setQuantity, remove, pending } = useCartMutations()
  const toast = useToast()
  const activeUnitId = getActiveUnitId()

  const cart = query.data
  const itemCountLabel = cart
    ? `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'itens'}`
    : null

  async function runMutation(action: () => Promise<{ ok: boolean }>) {
    const result = await action()
    if (!result.ok) toast.showError('Não foi possível atualizar o carrinho.')
  }

  return (
    <>
      <div className="pg-head shop-head">
        <button type="button" className="back shop-back" onClick={() => navigate(-1)}>
          ‹ Voltar
        </button>
      </div>

      <div className="dash-body shop-body">
        <h1 className="shop-cart-title">Carrinho{itemCountLabel ? ` (${itemCountLabel})` : ''}</h1>

        {query.isPending ? <PageLoading label="Carregando carrinho" variant="list" /> : null}
        {query.isError ? <p role="alert">Não foi possível carregar o carrinho.</p> : null}

        {cart && cart.itemCount === 0 ? (
          <div className="shop-empty">
            <EmptyState
              icon={<span className="shop-empty__glyph">🛒</span>}
              title="Seu carrinho está vazio"
              description="Os produtos que você adicionar aparecem aqui."
              actionLabel={activeUnitId ? 'Ir para a loja' : undefined}
              onAction={activeUnitId ? () => navigate(storeCatalogPath(activeUnitId)) : undefined}
            />
          </div>
        ) : null}

        {cart && cart.itemCount > 0 ? (
          <>
            {cart.groups.map((group) => (
              <CartGroupSection
                key={group.unitId}
                group={group}
                disabled={pending}
                showCheckout={cart.unitCount > 1}
                onCheckout={() => navigate(storeCheckoutPath(group.unitId))}
                onQuantity={(itemId, quantity) =>
                  runMutation(() => setQuantity({ itemId, quantity }))
                }
                onRemove={(itemId) => runMutation(() => remove(itemId))}
              />
            ))}

            {cart.unitCount > 1 ? (
              <p className="shop-cart-warning">
                ⚠️ Itens de arenas diferentes serão retirados em cada arena separadamente.
              </p>
            ) : null}

            <div className="shop-cart-summary">
              <div className="shop-cart-summary__row">
                <span>Subtotal</span>
                <span className="shop-cart-summary__value">{formatBRL(cart.total)}</span>
              </div>
              <div className="shop-cart-summary__divider" role="presentation" />
              <div className="shop-cart-summary__row shop-cart-summary__row--total">
                <span>Total</span>
                <span className="shop-cart-summary__value">{formatBRL(cart.total)}</span>
              </div>
            </div>

            {/* Um checkout fecha UMA arena (`POST /me/store/orders` recebe
                `{unit_id}`). Com uma arena só, o botão do frame vale como
                está; com mais de uma, um único "FINALIZAR COMPRA" teria de
                escolher a arena por conta própria — então o CTA desce para
                dentro de cada grupo, nomeando arena e subtotal, e o rodapé
                fica só com a explicação. */}
            {cart.unitCount === 1 ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!cart.groups[0]?.checkoutable}
                onClick={() => navigate(storeCheckoutPath(cart.groups[0]!.unitId))}
              >
                FINALIZAR COMPRA
              </Button>
            ) : (
              <p className="shop-cart-note">
                Cada arena tem seu próprio fechamento — use o botão dentro do grupo da arena.
              </p>
            )}
          </>
        ) : null}
      </div>

      <Toast message={toast.message} tone="danger" onDismiss={toast.dismiss} />
    </>
  )
}

function CartGroupSection({
  group,
  disabled,
  showCheckout,
  onCheckout,
  onQuantity,
  onRemove,
}: {
  group: CartGroup
  disabled: boolean
  showCheckout: boolean
  onCheckout: () => void
  onQuantity: (itemId: string, quantity: number) => void
  onRemove: (itemId: string) => void
}) {
  return (
    <section className="shop-cart-group" aria-label={group.unitName}>
      {/* O 🏟️ é decorativo e fica no `::before` do CSS, fora do nome
          acessível do heading — mesmo tratamento dos emojis de seção em
          TournamentsListPage. */}
      <h2 className="shop-cart-group__title">{group.unitName}</h2>
      {group.items.map((item) => (
        <CartRow
          key={item.id}
          item={item}
          disabled={disabled}
          onQuantity={onQuantity}
          onRemove={onRemove}
        />
      ))}
      {showCheckout ? (
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={disabled || !group.checkoutable}
          onClick={onCheckout}
        >
          FINALIZAR COMPRA — {formatBRL(group.subtotal)}
          <span className="shop-sr-only">, {group.unitName}</span>
        </Button>
      ) : null}
    </section>
  )
}

function CartRow({
  item,
  disabled,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  disabled: boolean
  onQuantity: (itemId: string, quantity: number) => void
  onRemove: (itemId: string) => void
}) {
  return (
    <div className={`shop-cart-item${item.available ? '' : ' shop-cart-item--unavailable'}`}>
      <div className="shop-cart-item__media">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
      </div>

      <div className="shop-cart-item__info">
        <span className="shop-cart-item__name">{item.productName}</span>
        {item.variantLabel ? (
          <span className="shop-cart-item__variant">{item.variantLabel}</span>
        ) : null}
        <span className="shop-cart-item__price">{formatBRL(item.unitPrice)}</span>
        {!item.available ? (
          <span className="shop-cart-item__unavailable">Indisponível nesta quantidade</span>
        ) : null}
      </div>

      <div className="shop-cart-item__actions">
        <button
          type="button"
          className="shop-qty"
          // Para em 1: `PATCH quantity: 0` é 400 no backend, e remover é o
          // botão ao lado.
          disabled={disabled || item.quantity <= 1}
          aria-label={`Diminuir quantidade de ${item.productName}`}
          onClick={() => onQuantity(item.id, item.quantity - 1)}
        >
          −
        </button>
        <span className="shop-qty__value" aria-label={`Quantidade: ${item.quantity}`}>
          {item.quantity}
        </span>
        <button
          type="button"
          className="shop-qty"
          disabled={disabled || item.quantity >= MAX_QUANTITY}
          aria-label={`Aumentar quantidade de ${item.productName}`}
          onClick={() => onQuantity(item.id, item.quantity + 1)}
        >
          +
        </button>
        <button
          type="button"
          className="shop-remove"
          disabled={disabled}
          onClick={() => onRemove(item.id)}
        >
          <span aria-hidden="true">🗑️</span> Remover
          <span className="shop-sr-only">, {item.productName}</span>
        </button>
      </div>
    </div>
  )
}
