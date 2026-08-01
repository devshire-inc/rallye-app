/**
 * Caminhos da Loja da Arena, num módulo só para as três telas (e a navegação
 * da casca) não montarem a mesma string à mão.
 *
 * A assimetria entre eles é a do próprio backend, não uma inconsistência: o
 * CATÁLOGO é escopado a uma arena (`/units/{id}/store/…`, a arena está no
 * path porque é ela que posiciona a RLS), enquanto o CARRINHO é objeto do
 * usuário e atravessa arenas (`/me/store/cart`) — uma rota de carrinho com
 * `unitId` prometeria um recorte por arena que não existe.
 *
 * O detalhe do produto carrega `unitId` pelo mesmo motivo que o endpoint
 * carrega: não há como resolver a arena a partir do id do produto.
 */
export const STORE_CATALOG_ROUTE = '/units/:unitId/store'
export const STORE_PRODUCT_ROUTE = '/units/:unitId/store/products/:productId'
export const STORE_CART_ROUTE = '/store/cart'

/**
 * O CHECKOUT leva `:unitId` — e não por simetria com o catálogo, mas porque é
 * o dado que define a operação: `POST /me/store/orders` recebe `{unit_id}` e
 * fecha o grupo DAQUELA arena, deixando o resto do carrinho intacto. Um
 * `/store/checkout` sem arena teria de escolher uma por conta própria, e a
 * escolha não é do sistema.
 *
 * Ainda assim a rota mora sob `/store/…` e não sob `/units/:id/store/…`: o
 * recurso continua sendo `/me/…` (a arena é parâmetro do corpo, não quem
 * posiciona a RLS), e aninhá-la no catálogo prometeria um checkout escopado
 * pela arena do path, que é o oposto de como o backend resolve permissão aqui.
 */
export const STORE_CHECKOUT_ROUTE = '/store/checkout/:unitId'

/** Lista e detalhe de pedidos NÃO levam arena: `GET /me/store/orders`
 * atravessa arenas (é a mesma consulta que devolve pedidos da Beira-Mar e da
 * Beach Master), e o detalhe é resolvido só pelo id do pedido. */
export const STORE_ORDERS_ROUTE = '/store/orders'
export const STORE_ORDER_ROUTE = '/store/orders/:orderId'

export const STORE_CART_PATH = STORE_CART_ROUTE
export const STORE_ORDERS_PATH = STORE_ORDERS_ROUTE

export function storeCatalogPath(unitId: string): string {
  return `/units/${unitId}/store`
}

export function storeProductPath(unitId: string, productId: string): string {
  return `/units/${unitId}/store/products/${productId}`
}

export function storeCheckoutPath(unitId: string): string {
  return `/store/checkout/${unitId}`
}

export function storeOrderPath(orderId: string): string {
  return `/store/orders/${orderId}`
}

/** Rota da tela de PIX já existente (`PixPaymentPage`, commit e2ff3bd). O
 * pedido é pago pela FATURA que o checkout gera — a Loja não emite cobrança,
 * não faz polling e não duplica nada disso; ela só manda o usuário para o
 * fluxo que já existe, com o `invoiceId` que o próprio pedido devolve. */
export function invoicePixPath(invoiceId: string): string {
  return `/invoices/${invoiceId}/pix`
}
