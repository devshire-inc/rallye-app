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

export const STORE_CART_PATH = STORE_CART_ROUTE

export function storeCatalogPath(unitId: string): string {
  return `/units/${unitId}/store`
}

export function storeProductPath(unitId: string, productId: string): string {
  return `/units/${unitId}/store/products/${productId}`
}
