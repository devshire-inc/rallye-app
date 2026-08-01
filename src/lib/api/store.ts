// Cliente HTTP da Loja da Arena — catálogo (escopo de arena) e carrinho
// (self-service, `/me/…`). Backend: commit 6fa7200 do rallye-api, pacote
// `api/internal/store`.
//
// Mesmo padrão de ./classOccurrences.ts e ./pixPayments.ts: usa `apiFetch`
// (nunca `fetch` cru), tipos wire em snake_case convertidos pra camelCase na
// borda, falha como `ApiFailure` com status/error/message.
//
// DUAS DECISÕES DO BACKEND QUE MOLDAM AS TELAS — vale ler antes de consumir:
//
// 1. **Preço e estoque vivem na VARIAÇÃO, não no produto.** O que existe na
//    prateleira é "Shark Pro Preta 340g", não "Shark Pro". O catálogo devolve
//    um `price` de vitrine e um `stockQuantity` que é a SOMA das variações
//    ativas; o que se adiciona ao carrinho é sempre um `variantId`. Por isso
//    `listStoreProducts` devolve `variants: []` (vazio, de propósito) e só
//    `getStoreProduct` traz as variações completas.
//
// 2. **O carrinho atravessa arenas.** Ele é objeto do USUÁRIO, não da arena —
//    por isso mora em `/me/store/cart` e a resposta já vem AGRUPADA por
//    arena (`groups`). As quatro rotas de carrinho devolvem o carrinho
//    INTEIRO, então o contador "🛒 (3)" do cabeçalho se atualiza na mesma
//    resposta da mutação, sem um GET extra.
import { apiFetch } from '../httpClient'

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return {
    ok: false,
    status: response.status,
    error: body.error ?? 'unknown_error',
    message: body.message,
  }
}

// ---------------------------------------------------------------------------
// Catálogo — GET /units/{id}/store/products[?category=&sport=&q=]
// ---------------------------------------------------------------------------

/** Catálogo fechado do backend (`store.Category`). Um valor fora desta lista
 * é IGNORADO pelo servidor, não vira 400 — filtro é navegação, e um chip
 * desconhecido não deve quebrar a tela. */
export type StoreCategory = 'raquetes' | 'bolas' | 'acessorios' | 'vestuario' | 'outros'

/** Mesmo catálogo fechado de esportes já usado no resto do app. */
export type StoreSport = 'beach_tennis' | 'padel' | 'futevolei' | 'volei' | 'tenis'

/** Selo do card (frame 22: "Mais vendido" / "Novo" / "Promoção"). */
export type StoreBadge = 'mais_vendido' | 'novo' | 'promocao'

export interface StoreVariant {
  id: string
  /** Rótulo pronto pra exibir, ex.: "Preto · 340g" — é o que o carrinho
   * mostra sob o nome do produto. String vazia quando o produto não tem
   * opções (todo produto tem ao menos UMA variação, mesmo sem opção). */
  label: string
  /** Dimensões independentes, ex.: `{ cor: 'Preto', peso: '340g' }`. A tela
   * 23 agrupa por CHAVE pra montar uma faixa de chips por dimensão. */
  options: Record<string, string>
  /** Preço EFETIVO em reais (o backend já resolveu COALESCE variação/produto). */
  price: number
  stockQuantity: number
  inStock: boolean
}

export interface StoreProduct {
  id: string
  unitId: string
  unitName: string
  name: string
  /** Vazia na LISTAGEM (o card não exibe); preenchida no detalhe. */
  description: string
  category: StoreCategory
  sport: StoreSport | null
  imageUrl: string | null
  /** Reais, não centavos (mesma unidade de `InvoiceDetail.amount`). */
  price: number
  /** Preço riscado. `null` quando não há promoção. */
  compareAtPrice: number | null
  /** Já vem pronto do backend (o "🔥 14% off" da tela 23); `null` sem
   * `compareAtPrice`. Nunca recalcular no cliente. */
  discountPercent: number | null
  badge: StoreBadge | null
  isActive: boolean
  /** Soma das variações ATIVAS. */
  stockQuantity: number
  inStock: boolean
  /** VAZIO na listagem, de propósito — só `getStoreProduct` preenche. */
  variants: StoreVariant[]
  createdAt: string
}

type StoreVariantWire = {
  id: string
  label: string
  options: Record<string, string> | null
  price: number
  stock_quantity: number
  in_stock: boolean
}

type StoreProductWire = {
  id: string
  unit_id: string
  unit_name: string
  name: string
  description: string
  category: StoreCategory
  sport: StoreSport | null
  image_url: string | null
  price: number
  compare_at_price: number | null
  discount_percent: number | null
  badge: StoreBadge | null
  is_active: boolean
  stock_quantity: number
  in_stock: boolean
  variants: StoreVariantWire[] | null
  created_at: string
}

function variantFromWire(wire: StoreVariantWire): StoreVariant {
  return {
    id: wire.id,
    label: wire.label ?? '',
    options: wire.options ?? {},
    price: wire.price,
    stockQuantity: wire.stock_quantity,
    inStock: wire.in_stock,
  }
}

function productFromWire(wire: StoreProductWire): StoreProduct {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    unitName: wire.unit_name,
    name: wire.name,
    description: wire.description ?? '',
    category: wire.category,
    sport: wire.sport ?? null,
    imageUrl: wire.image_url ?? null,
    price: wire.price,
    compareAtPrice: wire.compare_at_price ?? null,
    discountPercent: wire.discount_percent ?? null,
    badge: wire.badge ?? null,
    isActive: wire.is_active,
    stockQuantity: wire.stock_quantity,
    inStock: wire.in_stock,
    variants: (wire.variants ?? []).map(variantFromWire),
    createdAt: wire.created_at,
  }
}

export interface StoreCatalogFilters {
  category?: StoreCategory | null
  sport?: StoreSport | null
  q?: string | null
}

export interface ListStoreProductsSuccess {
  ok: true
  unitId: string
  /** Nome da arena — vem no TOPO da resposta de propósito: a tela 22b
   * (vazia) precisa nomear a arena sem ter nenhum produto de onde tirá-lo. */
  unitName: string
  products: StoreProduct[]
}

export type ListStoreProductsResult = ListStoreProductsSuccess | ApiFailure

/**
 * `GET /units/{id}/store/products` — catálogo da arena. Filtros opcionais e
 * combináveis (AND). Erro: `404 unit_not_found` (arena inexistente/inativa).
 *
 * Cross-arena por design: o aluno lê o catálogo de arena onde não tem
 * membership (o carrinho da tela 24 prova que isso acontece). Quem posiciona
 * a RLS na arena ALVO é o handler, a partir do id do path.
 */
export async function listStoreProducts(
  unitId: string,
  filters: StoreCatalogFilters = {},
): Promise<ListStoreProductsResult> {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.sport) params.set('sport', filters.sport)
  const q = filters.q?.trim()
  if (q) params.set('q', q)
  const query = params.toString()

  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/store/products${query ? `?${query}` : ''}`,
  )
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    unit_id: string
    unit_name: string
    items: StoreProductWire[] | null
  }
  return {
    ok: true,
    unitId: body.unit_id,
    unitName: body.unit_name,
    products: (body.items ?? []).map(productFromWire),
  }
}

export interface GetStoreProductSuccess {
  ok: true
  product: StoreProduct
}

export type GetStoreProductResult = GetStoreProductSuccess | ApiFailure

/**
 * `GET /units/{id}/store/products/{productId}` — mesmo objeto, com
 * `description` preenchida e `variants` completo. Erro: `404
 * product_not_found`.
 *
 * A arena vem no PATH e não é descoberta a partir do produto: resolver a
 * unit por um product id exigiria uma leitura sem RLS posicionada. Como toda
 * navegação chega aqui vinda do catálogo de uma arena, a arena já é conhecida
 * — por isso a rota da tela 23 carrega `unitId` também.
 */
export async function getStoreProduct(
  unitId: string,
  productId: string,
): Promise<GetStoreProductResult> {
  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/store/products/${encodeURIComponent(productId)}`,
  )
  if (!response.ok) return failureFrom(response)
  return { ok: true, product: productFromWire((await response.json()) as StoreProductWire) }
}

// ---------------------------------------------------------------------------
// Carrinho — /me/store/cart (self-service, atravessa arenas)
// ---------------------------------------------------------------------------

export interface CartItem {
  /** id do ITEM de carrinho — é o que vai no PATCH/DELETE, NÃO o variantId. */
  id: string
  variantId: string
  productId: string
  productName: string
  /** "Preto · 340g"; string vazia quando o produto não tem opções. */
  variantLabel: string
  imageUrl: string | null
  /** Lido AO VIVO do catálogo: carrinho é intenção, não documento. O preço
   * congelado só existe no pedido (fora do escopo desta leva). */
  unitPrice: number
  quantity: number
  lineTotal: number
  stockQuantity: number
  /** `false` = saiu do catálogo ou não há estoque pra quantidade pedida. */
  available: boolean
}

export interface CartGroup {
  unitId: string
  unitName: string
  items: CartItem[]
  subtotal: number
  /** `false` se algum item do grupo está indisponível — desabilita o
   * "FINALIZAR COMPRA" daquela arena. */
  checkoutable: boolean
}

export interface Cart {
  groups: CartGroup[]
  /** Contagem de LINHAS ("Carrinho (3 itens)"), não soma de quantidades. */
  itemCount: number
  /** `> 1` dispara o aviso "⚠️ Itens de arenas diferentes…" da tela 24. */
  unitCount: number
  total: number
}

type CartItemWire = {
  id: string
  variant_id: string
  product_id: string
  product_name: string
  variant_label: string
  image_url: string | null
  unit_price: number
  quantity: number
  line_total: number
  stock_quantity: number
  available: boolean
}

type CartGroupWire = {
  unit_id: string
  unit_name: string
  items: CartItemWire[] | null
  subtotal: number
  checkoutable: boolean
}

type CartWire = {
  groups: CartGroupWire[] | null
  item_count: number
  unit_count: number
  total: number
}

function cartItemFromWire(wire: CartItemWire): CartItem {
  return {
    id: wire.id,
    variantId: wire.variant_id,
    productId: wire.product_id,
    productName: wire.product_name,
    variantLabel: wire.variant_label ?? '',
    imageUrl: wire.image_url ?? null,
    unitPrice: wire.unit_price,
    quantity: wire.quantity,
    lineTotal: wire.line_total,
    stockQuantity: wire.stock_quantity,
    available: wire.available,
  }
}

function cartFromWire(wire: CartWire): Cart {
  return {
    groups: (wire.groups ?? []).map((group) => ({
      unitId: group.unit_id,
      unitName: group.unit_name,
      items: (group.items ?? []).map(cartItemFromWire),
      subtotal: group.subtotal,
      checkoutable: group.checkoutable,
    })),
    itemCount: wire.item_count,
    unitCount: wire.unit_count,
    total: wire.total,
  }
}

export interface CartSuccess {
  ok: true
  cart: Cart
}

export type CartResult = CartSuccess | ApiFailure

async function readCart(response: Response): Promise<CartResult> {
  if (!response.ok) return failureFrom(response)
  return { ok: true, cart: cartFromWire((await response.json()) as CartWire) }
}

/** `GET /me/store/cart` — o carrinho inteiro, agrupado por arena. */
export async function getCart(): Promise<CartResult> {
  return readCart(await apiFetch('/me/store/cart'))
}

/**
 * `POST /me/store/cart/items` — adiciona uma VARIAÇÃO ao carrinho.
 *
 * `quantity` ausente vira 1 no backend (a tela 23 não tem seletor de
 * quantidade). Idempotente na prática: adicionar a mesma variação SOMA na
 * linha existente (teto 99), nunca cria linha duplicada.
 *
 * A resposta traz `{item_id, quantity, cart}` — aqui só o carrinho interessa,
 * porque é ele que realimenta todas as telas.
 *
 * Erros: `404 variant_not_found` (inclui parear a arena A com uma variação da
 * arena B), `409 out_of_stock`, `404 unit_not_found`, `400 invalid_request`.
 */
export async function addCartItem(
  unitId: string,
  variantId: string,
  quantity?: number,
): Promise<CartResult> {
  const response = await apiFetch('/me/store/cart/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unit_id: unitId,
      variant_id: variantId,
      ...(quantity === undefined ? {} : { quantity }),
    }),
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as { cart: CartWire }
  return { ok: true, cart: cartFromWire(body.cart) }
}

/**
 * `PATCH /me/store/cart/items/{id}` — muda a quantidade de uma linha.
 *
 * `quantity: 0` é **400** no backend, não uma remoção: remover é
 * `removeCartItem` (a tela 24 tem um "🗑️ Remover" separado do "−"). Este
 * cliente não "conserta" isso mandando um DELETE por baixo — dois caminhos
 * silenciosos pro mesmo efeito é justamente o que o contrato evita. Quem
 * chama decide, e a tela decide olhando a quantidade atual.
 */
export async function updateCartItemQuantity(
  itemId: string,
  quantity: number,
): Promise<CartResult> {
  return readCart(
    await apiFetch(`/me/store/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    }),
  )
}

/** `DELETE /me/store/cart/items/{id}` — remove a linha. Erro: `404
 * cart_item_not_found`. */
export async function removeCartItem(itemId: string): Promise<CartResult> {
  return readCart(
    await apiFetch(`/me/store/cart/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
  )
}

// ---------------------------------------------------------------------------
// Pedidos — /me/store/orders (self-service, atravessa arenas)
// ---------------------------------------------------------------------------

/**
 * Status EXIBIDO do pedido. É **derivado** no backend (`store.DeriveStatus`),
 * não uma coluna: `cancelado` vence tudo; fatura não paga vira
 * `aguardando_pagamento`; só então vale o `fulfillmentStatus`. Por isso o
 * pedido não tem — e não deve ganhar — um estado de pagamento próprio: quem
 * sabe se foi pago é a FATURA (ver `invoiceId`/`invoiceStatus`).
 */
export type StoreOrderStatus =
  | 'aguardando_pagamento'
  | 'preparando'
  | 'pronto'
  | 'entregue'
  | 'cancelado'

/** Valor cru da coluna do pedido — descreve só o que a arena faz com a
 * mercadoria, sem nada de pagamento. Exposto porque o backend o devolve, mas
 * quem as telas exibem é o `status` acima. */
export type StoreFulfillmentStatus = 'preparando' | 'pronto' | 'entregue' | 'cancelado'

export interface StoreOrderItem {
  id: string
  variantId: string
  productName: string
  /** "Preto · 340g"; vazio quando o produto não tem opções. */
  variantLabel: string
  /** CONGELADO no fechamento (o carrinho lê preço ao vivo, o pedido não). */
  unitPrice: number
  quantity: number
  lineTotal: number
}

/** "📍 Retire na recepção" das telas 25/26. Sem coordenada: o backend devolve
 * endereço textual, e a distância "2,3 km"/"COMO CHEGAR" do frame 26 exigiria
 * geolocalização, que não existe em lado nenhum (ver gaps). */
export interface StoreOrderPickup {
  unitName: string
  address: string
  city: string
  state: string
}

export interface StoreOrder {
  id: string
  orderNumber: number
  /** "#0042", já formatado pelo backend — o cliente não repadroniza. */
  numberLabel: string
  unitId: string
  unitName: string
  status: StoreOrderStatus
  fulfillmentStatus: StoreFulfillmentStatus
  /** Fatura gerada no fechamento. É por ELA que o pedido é pago — o fluxo de
   * PIX (`/invoices/{id}/pix`) já existe e não é duplicado aqui. */
  invoiceId: string
  invoiceStatus: string
  total: number
  /** Contagem de LINHAS ("2 itens · R$ 447,00" do frame 27). */
  itemCount: number
  items: StoreOrderItem[]
  pickup: StoreOrderPickup
  createdAt: string
  readyAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
}

type StoreOrderItemWire = {
  id: string
  variant_id: string
  product_name: string
  variant_label: string
  unit_price: number
  quantity: number
  line_total: number
}

type StoreOrderWire = {
  id: string
  order_number: number
  number_label: string
  unit_id: string
  unit_name: string
  student_id: string
  status: StoreOrderStatus
  fulfillment_status: StoreFulfillmentStatus
  invoice_id: string
  invoice_status: string
  total: number
  item_count: number
  items: StoreOrderItemWire[] | null
  pickup: {
    unit_name: string
    address: string | null
    city: string | null
    state: string | null
  } | null
  created_at: string
  ready_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
}

function orderFromWire(wire: StoreOrderWire): StoreOrder {
  return {
    id: wire.id,
    orderNumber: wire.order_number,
    numberLabel: wire.number_label,
    unitId: wire.unit_id,
    unitName: wire.unit_name,
    status: wire.status,
    fulfillmentStatus: wire.fulfillment_status,
    invoiceId: wire.invoice_id,
    invoiceStatus: wire.invoice_status,
    total: wire.total,
    itemCount: wire.item_count,
    items: (wire.items ?? []).map((item) => ({
      id: item.id,
      variantId: item.variant_id,
      productName: item.product_name,
      variantLabel: item.variant_label ?? '',
      unitPrice: item.unit_price,
      quantity: item.quantity,
      lineTotal: item.line_total,
    })),
    pickup: {
      unitName: wire.pickup?.unit_name ?? wire.unit_name,
      address: wire.pickup?.address ?? '',
      city: wire.pickup?.city ?? '',
      state: wire.pickup?.state ?? '',
    },
    createdAt: wire.created_at,
    readyAt: wire.ready_at ?? null,
    deliveredAt: wire.delivered_at ?? null,
    cancelledAt: wire.cancelled_at ?? null,
  }
}

/** Uma linha do `409 insufficient_stock`: o backend diz exatamente quanto foi
 * pedido e quanto sobrou, por variação, para a tela poder nomear o produto em
 * vez de dizer "algo acabou". */
export interface StoreStockIssue {
  variantId: string
  productName: string
  requested: number
  available: number
}

/** `ApiFailure` do checkout, com as linhas do `409 insufficient_stock` quando
 * o erro é esse. */
export interface CreateStoreOrderFailure extends ApiFailure {
  stockIssues: StoreStockIssue[]
}

export interface CreateStoreOrderSuccess {
  ok: true
  order: StoreOrder
}

export type CreateStoreOrderResult = CreateStoreOrderSuccess | CreateStoreOrderFailure

/**
 * `POST /me/store/orders` — fecha o grupo de UMA arena.
 *
 * O corpo é só `{unit_id}`: itens, quantidades e total vêm do banco. Mandar a
 * lista abriria porta para preço/quantidade forjados, e mandar o total só
 * tornaria o servidor verificador de uma conta que ele mesmo faz.
 *
 * Numa transação o backend trava o grupo, reserva o estoque, numera o pedido,
 * grava os snapshots, **gera a fatura** e esvazia SÓ aquele grupo do carrinho
 * — os itens das outras arenas continuam lá. Por isso quem chama precisa
 * invalidar o carrinho (ver ../query/store.ts): ao contrário das quatro rotas
 * de carrinho, esta NÃO devolve o carrinho novo.
 *
 * Erros: `409 empty_cart` (inclui o duplo clique em CONFIRMAR, que vira 409 e
 * não um segundo pedido), `409 insufficient_stock` com as linhas em
 * `stockIssues` (a transação inteira é desfeita — não existe pedido parcial
 * nem reserva fantasma), `404 unit_not_found`.
 */
export async function createStoreOrder(unitId: string): Promise<CreateStoreOrderResult> {
  const response = await apiFetch('/me/store/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit_id: unitId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'unknown_error',
      message: body.message,
      stockIssues: (
        (body.items ?? []) as {
          variant_id: string
          product_name: string
          requested: number
          available: number
        }[]
      ).map((item) => ({
        variantId: item.variant_id,
        productName: item.product_name,
        requested: item.requested,
        available: item.available,
      })),
    }
  }

  return { ok: true, order: orderFromWire((await response.json()) as StoreOrderWire) }
}

export interface ListStoreOrdersSuccess {
  ok: true
  orders: StoreOrder[]
}

export type ListStoreOrdersResult = ListStoreOrdersSuccess | ApiFailure

/** `GET /me/store/orders` — ATRAVESSA arenas, mais recentes primeiro. `items`
 * vem preenchido também na listagem (um pedido tem poucas linhas), então a
 * tela 27 não precisa de um GET por pedido para escrever "2 itens". */
export async function listStoreOrders(): Promise<ListStoreOrdersResult> {
  const response = await apiFetch('/me/store/orders')
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as { items: StoreOrderWire[] | null }
  return { ok: true, orders: (body.items ?? []).map(orderFromWire) }
}

export interface GetStoreOrderSuccess {
  ok: true
  order: StoreOrder
}

export type GetStoreOrderResult = GetStoreOrderSuccess | ApiFailure

/** `GET /me/store/orders/{id}` — self-only. Pedido de outra pessoa é `404
 * order_not_found`, nunca 403: o backend não vaza a existência do pedido. */
export async function getStoreOrder(orderId: string): Promise<GetStoreOrderResult> {
  const response = await apiFetch(`/me/store/orders/${encodeURIComponent(orderId)}`)
  if (!response.ok) return failureFrom(response)
  return { ok: true, order: orderFromWire((await response.json()) as StoreOrderWire) }
}

// ---------------------------------------------------------------------------
// Rótulos — catálogos fechados do backend traduzidos pra UI
// ---------------------------------------------------------------------------

/** Rótulos dos chips de categoria (frame 22: "Todos · Raquetes · Bolas ·
 * Acessórios"). A ordem é a do frame; "Todos" é ausência de filtro, não um
 * valor do enum, então não entra aqui. */
export const CATEGORY_LABEL: Record<StoreCategory, string> = {
  raquetes: 'Raquetes',
  bolas: 'Bolas',
  acessorios: 'Acessórios',
  vestuario: 'Vestuário',
  outros: 'Outros',
}

export const CATEGORY_ORDER: StoreCategory[] = [
  'raquetes',
  'bolas',
  'acessorios',
  'vestuario',
  'outros',
]

/** Selos do card. O frame escreve "Mais vendido"/"Novo"; "Promoção" é o
 * terceiro valor do enum, sem frame próprio. */
export const BADGE_LABEL: Record<StoreBadge, string> = {
  mais_vendido: 'Mais vendido',
  novo: 'Novo',
  promocao: 'Promoção',
}

/** Rótulo do status derivado do pedido (frames 26/27). O texto sozinho é o
 * nome acessível — os emojis do frame vivem em `STORE_ORDER_STATUS_GLYPH`,
 * marcados como decorativos, para o leitor de tela não ler "círculo verde"
 * antes de "pronto para retirada". */
export const STORE_ORDER_STATUS_LABEL: Record<StoreOrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  preparando: 'Preparando',
  pronto: 'Pronto para retirada',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

/** Emoji do frame 27, puramente decorativo. `aguardando_pagamento` e
 * `cancelado` não têm frame próprio (o protótipo só desenha os três de
 * fulfillment), então usam o 💠 que o frame 25 já dá ao PIX e um ✕ neutro. */
export const STORE_ORDER_STATUS_GLYPH: Record<StoreOrderStatus, string> = {
  aguardando_pagamento: '💠',
  preparando: '📦',
  pronto: '🟢',
  entregue: '✅',
  cancelado: '✕',
}
