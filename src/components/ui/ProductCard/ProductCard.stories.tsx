import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProductCard } from './ProductCard'
import './ProductCard.stories.css'

const meta = {
  title: 'ui/ProductCard',
  component: ProductCard,
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'text' },
    price: { control: 'text' },
    oldPrice: { control: 'text' },
    tag: { control: 'text' },
    image: { control: 'text' },
    arenaName: { control: 'text' },
    reviewLabel: { control: 'text' },
    onClick: { control: 'boolean' },
  },
  args: {
    name: 'Raquete Beach Tennis Pro',
    price: 'R$ 289,90',
    oldPrice: undefined,
    tag: undefined,
    image: undefined,
    arenaName: undefined,
    reviewLabel: undefined,
  },
} satisfies Meta<typeof ProductCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * `onClick` no Storybook aceita `true`/`false` via control; quando `true`
 * o card renderiza como `<button>` (Figma node 44:33, State=Hover ao passar
 * o mouse — a elevação de Shadow/Card para Shadow/Raised não é simulável
 * estaticamente no Docs, veja no canvas renderizado).
 */
export const Playground: Story = {
  render: (args) => (
    <div className="product-card-story-wrap">
      <ProductCard {...args} onClick={args.onClick ? () => {} : undefined} />
    </div>
  ),
}

/** Grade HasTag=false/true (node 44:33) — passe o mouse sobre qualquer card
 * no canvas para ver o State=Hover real (Shadow/Card -> Shadow/Raised). */
export const States: Story = {
  render: () => (
    <div className="product-card-story-grid">
      <ProductCard name="Raquete Beach Tennis Pro" price="R$ 289,90" onClick={() => {}} />
      <ProductCard
        name="Raquete Beach Tennis Pro"
        price="R$ 289,90"
        tag="Promoção"
        onClick={() => {}}
      />
    </div>
  ),
}

/**
 * Regressão de largura do próprio time de design (QA — Width Stress Test,
 * node 330:1332): o card é testado sem corte em 160/171/180px — abaixo de
 * ~178px o priceRow quebra em wrap (node 44:21) em vez de cortar texto.
 */
export const WidthStress: Story = {
  render: () => (
    <div className="product-card-story-width-stress">
      {[160, 171, 180].map((width) => (
        <div key={width} style={{ width }}>
          <span>{width}px</span>
          <ProductCard name="Raquete Beach Tennis Pro" price="R$ 289,90" oldPrice="R$ 349,90" />
        </div>
      ))}
    </div>
  ),
}

/** Decoupled: HasTag=false + HasOldPrice=true, e HasArenaName + HasReview
 * (node 330:1468 — a própria dupla de regressão do time de design). */
export const Decoupled: Story = {
  render: () => (
    <div className="product-card-story-grid">
      <ProductCard name="Raquete Beach Tennis Pro" price="R$ 289,90" oldPrice="R$ 349,90" />
      <ProductCard
        name="Raquete Beach Tennis Pro"
        price="R$ 289,90"
        arenaName="Arena Beira-Mar"
        reviewLabel="⭐ 4.7 (23)"
      />
    </div>
  ),
}
