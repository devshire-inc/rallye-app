import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProductCard } from './ProductCard'

describe('ProductCard', () => {
  it('imports the real Badge component — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/ProductCard/ProductCard.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/Badge\/Badge['"]/)
  })

  it('renders name, price and oldPrice when given', () => {
    render(<ProductCard name="Raquete Beach Tennis" price="R$ 350" oldPrice="R$ 420" />)
    expect(
      screen.getByText('Raquete Beach Tennis', { selector: '.product-card__name' }),
    ).toBeInTheDocument()
    expect(screen.getByText('R$ 350')).toBeInTheDocument()
    expect(screen.getByText('R$ 420')).toBeInTheDocument()
  })

  it('does not render a Badge when tag is absent', () => {
    render(<ProductCard name="Bola" price="R$ 20" />)
    expect(screen.queryByText(/./, { selector: '.badge' })).not.toBeInTheDocument()
  })

  it('renders a real Badge when tag is given', () => {
    render(<ProductCard name="Bola" price="R$ 20" tag="Promoção" />)
    expect(screen.getByText('Promoção')).toBeInTheDocument()
  })

  it('renders oldPrice independently of tag (node 330:1468 — HasOldPrice without HasTag)', () => {
    render(<ProductCard name="Bola" price="R$ 20" oldPrice="R$ 30" />)
    expect(screen.getByText('R$ 30')).toBeInTheDocument()
    expect(screen.queryByText(/./, { selector: '.badge' })).not.toBeInTheDocument()
  })

  it('renders a text placeholder when image is absent', () => {
    render(<ProductCard name="Bola" price="R$ 20" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Bola', { selector: '.product-card__placeholder' })).toBeInTheDocument()
  })

  it('renders an <img> with a non-empty alt when image is given', () => {
    render(<ProductCard name="Bola" price="R$ 20" image="https://example.com/bola.png" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/bola.png')
    expect(img.getAttribute('alt')).toBe('Bola')
  })

  it('uses a non-empty fallback alt when image is given without a name', () => {
    render(<ProductCard price="R$ 20" image="https://example.com/produto.png" />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('alt')).toBe('Produto')
  })

  it('does not render an arena name or review label when absent', () => {
    render(<ProductCard name="Bola" price="R$ 20" />)
    expect(document.querySelector('.product-card__arena')).not.toBeInTheDocument()
    expect(document.querySelector('.product-card__review')).not.toBeInTheDocument()
  })

  it('renders arenaName when given (multi-arena marketplace label)', () => {
    render(<ProductCard name="Bola" price="R$ 20" arenaName="Arena Beira-Mar" />)
    expect(
      screen.getByText('Arena Beira-Mar', { selector: '.product-card__arena' }),
    ).toBeInTheDocument()
  })

  it('renders reviewLabel when given', () => {
    render(<ProductCard name="Bola" price="R$ 20" reviewLabel="⭐ 4.7 (23)" />)
    expect(
      screen.getByText('⭐ 4.7 (23)', { selector: '.product-card__review' }),
    ).toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<ProductCard name="Bola" price="R$ 20" />)
    expect(container.querySelector('div.product-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ProductCard name="Bola" price="R$ 20" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Bola/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('CSS: media is a fixed 120px height (node 44:16), price is highlighted with --text-brand, no hex literals', () => {
    const css = readFileSync('src/components/ui/ProductCard/ProductCard.css', 'utf8')
    expect(css).toMatch(/\.product-card__media\s*\{[^}]*height:\s*120px/)
    const priceBlock = /\.product-card__price\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(priceBlock).toMatch(/color:\s*var\(--text-brand\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: old price is struck through (node doc: "preço riscado")', () => {
    const css = readFileSync('src/components/ui/ProductCard/ProductCard.css', 'utf8')
    const oldPriceBlock = /\.product-card__old-price\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(oldPriceBlock).toMatch(/text-decoration:\s*line-through/)
  })

  it('CSS: button hover elevates from Shadow/Card to Shadow/Raised (node 85:104)', () => {
    const css = readFileSync('src/components/ui/ProductCard/ProductCard.css', 'utf8')
    expect(css).toMatch(/\.product-card\s*\{[^}]*box-shadow:\s*var\(--shadow-card\)/)
    expect(css).toMatch(/button\.product-card:hover[^{]*\{[^}]*box-shadow:\s*var\(--shadow-raised\)/)
  })
})
