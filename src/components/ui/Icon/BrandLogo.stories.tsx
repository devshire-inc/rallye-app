import type { Meta, StoryObj } from '@storybook/react-vite'
import { BrandLogo, type BrandLogoProps } from './BrandLogo'
import './Icon.stories.css'

const meta = {
  title: 'ui/BrandLogo',
  component: BrandLogo,
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'select',
      options: ['google', 'whatsapp', 'pix', 'apple', 'rallye-mark', 'rallye-lockup'],
    },
    variant: {
      control: 'select',
      options: [undefined, 'black', 'white', 'dark', 'light'],
    },
    size: {
      control: { type: 'range', min: 16, max: 96, step: 1 },
    },
  },
  args: {
    name: 'google',
    size: 24,
  } as BrandLogoProps,
} satisfies Meta<typeof BrandLogo>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Logos de marca de terceiros — cor fixa por marca, nunca vinculada a token (Figma node 341:117). */
export const ThirdPartyLogos: Story = {
  render: () => (
    <div className="icon-story-row">
      {(['google', 'whatsapp', 'pix'] as const).map((name) => (
        <div key={name} className="icon-story-swatch">
          <BrandLogo name={name} size={32} />
          <span className="icon-story-swatch__label">{name}</span>
        </div>
      ))}
    </div>
  ),
}

/** Apple exige a variante Color=Black/White — a troca é sempre manual, nunca automática por dark mode. */
export const AppleVariants: Story = {
  render: () => (
    <div className="icon-story-row">
      <div className="icon-story-swatch">
        <BrandLogo name="apple" variant="black" size={32} />
        <span className="icon-story-swatch__label">black</span>
      </div>
      <div className="icon-story-swatch icon-story-swatch--dark">
        <BrandLogo name="apple" variant="white" size={32} />
        <span className="icon-story-swatch__label">white</span>
      </div>
    </div>
  ),
}

/** Rallye mark/lockup — variante Color=Dark/Light, escolha manual (mesmo padrão do Apple). */
export const RallyeVariants: Story = {
  render: () => (
    <div className="icon-story-row">
      <div className="icon-story-swatch">
        <BrandLogo name="rallye-mark" variant="dark" size={32} />
        <span className="icon-story-swatch__label">mark / dark</span>
      </div>
      <div className="icon-story-swatch icon-story-swatch--dark">
        <BrandLogo name="rallye-mark" variant="light" size={32} />
        <span className="icon-story-swatch__label">mark / light</span>
      </div>
      <div className="icon-story-swatch">
        <BrandLogo name="rallye-lockup" variant="dark" size={48} />
        <span className="icon-story-swatch__label">lockup / dark</span>
      </div>
      <div className="icon-story-swatch icon-story-swatch--dark">
        <BrandLogo name="rallye-lockup" variant="light" size={48} />
        <span className="icon-story-swatch__label">lockup / light</span>
      </div>
    </div>
  ),
}
