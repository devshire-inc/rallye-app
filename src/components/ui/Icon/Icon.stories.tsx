import type { Meta, StoryObj } from '@storybook/react-vite'
import { Icon, ICON_NAMES } from './Icon'
import './Icon.stories.css'

const meta = {
  title: 'ui/Icon',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'select',
      options: ICON_NAMES,
    },
    size: {
      control: { type: 'range', min: 12, max: 64, step: 1 },
    },
    ariaHidden: {
      control: 'boolean',
    },
  },
  args: {
    name: 'home',
    size: 24,
    ariaHidden: true,
  },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Catálogo completo — todo ícone publicado no Figma (node 115:2), para auditoria visual de uma vez. */
export const AllIcons: Story = {
  render: () => (
    <div className="icon-story-grid">
      {ICON_NAMES.map((name) => (
        <div key={name} className="icon-story-cell">
          <Icon name={name} size={24} />
          <span className="icon-story-cell__name">{name}</span>
        </div>
      ))}
    </div>
  ),
}

/** Teste de escala do doc/icon-scaling (node 250:398): o desenho deve reduzir mantendo-se centrado, o traço não escala. */
export const Sizes: Story = {
  render: () => (
    <div className="icon-story-row">
      {[16, 20, 24, 32, 40].map((size) => (
        <div key={size} className="icon-story-swatch">
          <Icon name="settings" size={size} />
          <span className="icon-story-swatch__label">{size}px</span>
        </div>
      ))}
    </div>
  ),
}

/** O stroke usa currentColor — herda a cor de texto do contexto, incluindo dark mode. */
export const InheritsColor: Story = {
  render: () => (
    <div className="icon-story-row">
      <div className="icon-story-swatch">
        <Icon name="bell" size={32} />
        <span className="icon-story-swatch__label">tema claro</span>
      </div>
      <div className="icon-story-swatch icon-story-swatch--dark">
        <span style={{ color: 'var(--text-inverse)' }}>
          <Icon name="bell" size={32} />
        </span>
      </div>
    </div>
  ),
}
