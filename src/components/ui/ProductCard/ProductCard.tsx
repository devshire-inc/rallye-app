import { Badge } from '../Badge/Badge'
import './ProductCard.css'

export interface ProductCardProps {
  name?: string
  price?: string
  oldPrice?: string
  tag?: string
  image?: string
  arenaName?: string
  reviewLabel?: string
  onClick?: () => void
}

export function ProductCard({
  name,
  price,
  oldPrice,
  tag,
  image,
  arenaName,
  reviewLabel,
  onClick,
}: ProductCardProps) {
  const content = (
    <>
      <div className="product-card__media">
        {image ? (
          <img src={image} alt={name ?? 'Produto'} />
        ) : (
          <span className="product-card__placeholder">{name ?? 'Produto'}</span>
        )}
        {tag ? (
          <span className="product-card__tag">
            <Badge tone="brand">{tag}</Badge>
          </span>
        ) : null}
      </div>
      <div className="product-card__body">
        {name ? <span className="product-card__name">{name}</span> : null}
        <div className="product-card__prices">
          {price ? <span className="product-card__price">{price}</span> : null}
          {oldPrice ? <span className="product-card__old-price">{oldPrice}</span> : null}
        </div>
        {arenaName ? <span className="product-card__arena">{arenaName}</span> : null}
        {reviewLabel ? <span className="product-card__review">{reviewLabel}</span> : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="product-card" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="product-card">{content}</div>
}
