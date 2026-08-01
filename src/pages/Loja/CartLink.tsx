import { Link } from 'react-router-dom'
import { useCartItemCount } from '../../hooks/useCart'
import { STORE_CART_PATH } from './routes'

/**
 * O "🛒 (3)" que as três telas da Loja desenham no canto do cabeçalho
 * (frames 177:5652, 177:5750 e o desktop 189:2608). Um componente só porque
 * as três telas o mostram e todas leem a MESMA entrada de cache do carrinho —
 * ver ../../hooks/useCart.ts.
 *
 * O carrinho é do usuário e atravessa arenas, então o destino não leva
 * `unitId`: é sempre a mesma tela 24, independente de qual catálogo estava
 * aberto.
 *
 * O emoji é decorativo (`aria-hidden`); quem carrega a informação é o texto
 * do label, que diz "Carrinho, N itens" por extenso em vez de "(3)".
 */
export function CartLink() {
  const count = useCartItemCount()

  return (
    <Link
      className="shop-cart-link"
      to={STORE_CART_PATH}
      aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'}
    >
      <span aria-hidden="true">🛒</span>
      {count > 0 ? <span className="shop-cart-link__count">({count})</span> : null}
    </Link>
  )
}
