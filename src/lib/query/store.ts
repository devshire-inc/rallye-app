/**
 * Queries e mutations da Loja da Arena — catálogo (`GET
 * /units/{id}/store/products[/{productId}]`) e carrinho (`/me/store/cart`).
 *
 * Este é o PRIMEIRO domínio de feature migrado pro TanStack Query: até aqui
 * só os três dados globais de identidade e o contador de notificações
 * estavam na camada (ver ./queryClient.ts, ./identity.ts, ./notifications.ts)
 * — as demais telas ainda fazem `fetch` em `useEffect`. A Loja entra porque é
 * exatamente o caso de uso que justifica a camada:
 *
 * - o CONTADOR do carrinho aparece no cabeçalho das TRÊS telas (22/23/24).
 *   Com fetch por tela, cada navegação re-buscaria o carrinho e o número
 *   piscaria; por chave compartilhada, as três leem a mesma entrada.
 * - toda mutação de carrinho devolve o carrinho INTEIRO. Isso combina com
 *   `setQueryData` (ver `applyCartResult`): a resposta da mutação JÁ é o novo
 *   estado, então o padrão certo é semear o cache com ela e NÃO refetchar.
 *   `invalidateQueries` aqui geraria um `GET /me/store/cart` redundante logo
 *   depois de cada +/−/remover.
 *
 * Mesma convenção de ./identity.ts e ./notifications.ts: namespace próprio
 * para as chaves e `queryOptions` exportada daqui — ninguém monta uma chave
 * de loja à mão, sob pena de criar uma segunda entrada de cache.
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query'
import {
  getCart,
  getStoreOrder,
  getStoreProduct,
  listStoreOrders,
  listStoreProducts,
  type ApiFailure,
  type Cart,
  type CartResult,
  type StoreCatalogFilters,
  type StoreOrder,
  type StoreProduct,
} from '../api/store'

/**
 * `catalog` e `cart` são ramos IRMÃOS sob o mesmo namespace, e não um só:
 * o catálogo é dado de arena (invalida ao trocar de arena/filtro), o carrinho
 * é dado do usuário e atravessa arenas. Invalidar um nunca deve derrubar o
 * outro — por isso não existe uma chave "tudo da loja" usada em mutação.
 */
export const storeKeys = {
  all: ['store'] as const,
  catalog: ['store', 'catalog'] as const,
  /** Os filtros entram na CHAVE (e não num `select` por cima de um cache
   * único) porque a filtragem acontece no servidor: `q` é ILIKE em nome e
   * descrição, coisa que o cliente não consegue reproduzir. Cada combinação
   * de filtros é, de fato, um recurso diferente. */
  catalogList: (unitId: string, filters: StoreCatalogFilters) =>
    [
      'store',
      'catalog',
      unitId,
      { category: filters.category ?? null, sport: filters.sport ?? null, q: filters.q ?? '' },
    ] as const,
  product: (unitId: string, productId: string) =>
    ['store', 'catalog', unitId, 'product', productId] as const,
  cart: ['store', 'cart'] as const,
  /** Terceiro ramo irmão. Pedido é dado do usuário como o carrinho, mas com
   * ciclo de vida oposto: o carrinho muda a toda hora e o pedido é imutável
   * depois de criado (só o STATUS anda, e por fora — pela fatura e pelo
   * balcão da arena). Por isso as duas chaves não se invalidam mutuamente,
   * exceto no checkout, que é justamente o instante em que um vira o outro. */
  orders: ['store', 'orders'] as const,
  order: (orderId: string) => ['store', 'orders', orderId] as const,
}

/** Falha de uma leitura da Loja transportada como exceção. Mesmo motivo de
 * `MeUnavailableError` em ./identity.ts: os clientes devolvem
 * `{ ok: false, … }` sem lançar, e se isso virasse "dado bom" o react-query
 * aplicaria o staleTime em cima de um 404/500 transitório — a tela ficaria
 * presa no erro até uma invalidação manual. Como erro, a próxima montagem
 * tenta de novo, e a tela lê `failure` para distinguir 404 de falha de rede. */
export class StoreRequestError extends Error {
  readonly failure: ApiFailure

  constructor(context: string, failure: ApiFailure) {
    super(`${context} failed: ${failure.error}`)
    this.name = 'StoreRequestError'
    this.failure = failure
  }
}

/** Extrai o `ApiFailure` de um erro de query da Loja — `null` para qualquer
 * outra coisa (erro de rede, bug). As telas usam isto para distinguir "esta
 * arena/produto não existe" (404) de "não deu para carregar". */
export function storeFailureOf(error: unknown): ApiFailure | null {
  return error instanceof StoreRequestError ? error.failure : null
}

export interface StoreCatalog {
  unitId: string
  unitName: string
  products: StoreProduct[]
}

/**
 * 30 segundos, bem abaixo dos 5 minutos do default global (./queryClient.ts):
 * catálogo é estoque, e estoque muda por baixo do usuário — a arena cadastra
 * produto, outro aluno compra a última unidade. Ao mesmo tempo, é o dado que
 * o usuário mais re-visita nesta feature (catálogo → detalhe → voltar), então
 * uma janela curta ainda absorve o vai-e-vem sem round-trip.
 */
const CATALOG_STALE_TIME_MS = 30 * 1000

export function storeCatalogQueryOptions(unitId: string, filters: StoreCatalogFilters = {}) {
  return queryOptions<StoreCatalog>({
    queryKey: storeKeys.catalogList(unitId, filters),
    queryFn: async () => {
      const result = await listStoreProducts(unitId, filters)
      if (!result.ok) throw new StoreRequestError('GET /units/{id}/store/products', result)
      return { unitId: result.unitId, unitName: result.unitName, products: result.products }
    },
    staleTime: CATALOG_STALE_TIME_MS,
    // `retry: false` — um 404 de arena inexistente não melhora com uma
    // segunda tentativa, e a tela precisa poder dizer isso rápido.
    retry: false,
  })
}

export function storeProductQueryOptions(unitId: string, productId: string) {
  return queryOptions<StoreProduct>({
    queryKey: storeKeys.product(unitId, productId),
    queryFn: async () => {
      const result = await getStoreProduct(unitId, productId)
      if (!result.ok)
        throw new StoreRequestError('GET /units/{id}/store/products/{productId}', result)
      return result.product
    },
    staleTime: CATALOG_STALE_TIME_MS,
    retry: false,
  })
}

/**
 * `GET /me/store/cart`.
 *
 * `staleTime: 0` (contra os 5 min do default): o carrinho é o dado mais
 * volátil da feature e o único que o próprio usuário muda a toda hora. As
 * mutações mantêm o cache correto por `setQueryData` — o staleTime zerado é
 * só a rede de segurança para quando o carrinho mudou em OUTRA aba/sessão.
 *
 * `retry: false` pelo mesmo motivo das leituras de catálogo, e porque o
 * contador do cabeçalho é decoração: não vale um segundo round-trip.
 */
export function cartQueryOptions() {
  return queryOptions<Cart>({
    queryKey: storeKeys.cart,
    queryFn: async () => {
      const result = await getCart()
      if (!result.ok) throw new StoreRequestError('GET /me/store/cart', result)
      return result.cart
    },
    staleTime: 0,
    retry: false,
  })
}

/**
 * Semeia o cache do carrinho com a resposta de uma mutação e devolve o
 * resultado inalterado, para quem chamou ainda poder tratar a falha.
 *
 * É o miolo do contrato "as quatro rotas devolvem o carrinho inteiro": em
 * sucesso, o cache já fica com o estado novo e nenhuma tela precisa refetchar
 * (nem o contador do cabeçalho, que observa esta mesma chave). Em falha, o
 * cache NÃO é tocado — a tela mostra o erro sem perder o carrinho que já
 * estava na frente do usuário.
 *
 * Note que o catálogo NÃO é invalidado aqui, embora adicionar ao carrinho não
 * mexa em estoque (o backend só reserva no checkout, ver seção 2 do resumo do
 * backend). Invalidar seria "por via das dúvidas" — e custaria um refetch do
 * catálogo a cada clique em "adicionar".
 */
export function applyCartResult(queryClient: QueryClient, result: CartResult): CartResult {
  if (result.ok) queryClient.setQueryData(storeKeys.cart, result.cart)
  return result
}

/**
 * `GET /me/store/orders` — a lista da tela 27, atravessando arenas.
 *
 * `staleTime: 0` e não os 5 min do default global: o pedido em si é imutável,
 * mas o STATUS que a tela mostra é derivado e muda por dois caminhos que
 * acontecem FORA desta aba — a fatura sendo paga e o balcão da arena movendo
 * o fulfillment. Uma janela de cache aqui mostraria "aguardando pagamento"
 * para um pedido já pago, que é exatamente a pergunta que traz o usuário à
 * tela.
 */
export function storeOrdersQueryOptions() {
  return queryOptions<StoreOrder[]>({
    queryKey: storeKeys.orders,
    queryFn: async () => {
      const result = await listStoreOrders()
      if (!result.ok) throw new StoreRequestError('GET /me/store/orders', result)
      return result.orders
    },
    staleTime: 0,
    retry: false,
  })
}

/** `GET /me/store/orders/{id}` — o pedido da tela 26. Mesmo `staleTime: 0`
 * pelo mesmo motivo: é para cá que o usuário volta depois de pagar o PIX, e
 * o status precisa estar fresco nesse retorno. */
export function storeOrderQueryOptions(orderId: string) {
  return queryOptions<StoreOrder>({
    queryKey: storeKeys.order(orderId),
    queryFn: async () => {
      const result = await getStoreOrder(orderId)
      if (!result.ok) throw new StoreRequestError('GET /me/store/orders/{id}', result)
      return result.order
    },
    staleTime: 0,
    retry: false,
  })
}

/**
 * Reconcilia o cache depois de um checkout bem-sucedido.
 *
 * Aqui é `invalidateQueries` e NÃO `setQueryData` — o oposto do que as
 * mutações de carrinho fazem, e de propósito: `POST /me/store/orders` devolve
 * o PEDIDO, não o carrinho novo. O servidor esvaziou o grupo daquela arena (e
 * só ele), então o carrinho em cache está desatualizado e ninguém tem o valor
 * correto para semeá-lo — inclusive o contador "🛒 (3)" do cabeçalho, que
 * continuaria contando linhas que não existem mais.
 *
 * A lista de pedidos é invalidada pelo mesmo motivo, e o pedido recém-criado é
 * semeado direto: a tela 26 abre com ele sem esperar um GET.
 */
export function applyCheckoutResult(queryClient: QueryClient, order: StoreOrder): void {
  queryClient.setQueryData(storeKeys.order(order.id), order)
  // `orders` é prefixo de `order(id)`, então esta invalidação também marca o
  // pedido semeado acima como stale — o que é correto: o `staleTime: 0` da
  // tela 26 já iria refetchá-lo, e o dado semeado serve para a primeira
  // pintura não ser um spinner.
  void queryClient.invalidateQueries({ queryKey: storeKeys.orders })
  void queryClient.invalidateQueries({ queryKey: storeKeys.cart })
}
