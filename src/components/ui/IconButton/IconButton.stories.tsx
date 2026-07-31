import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconButton } from './IconButton'
import './IconButton.stories.css'

/** Storybook-only placeholder icon (inline SVG, `currentColor` stroke) — the
 * Figma source (node 26:3) marks its icon as an internal placeholder to be
 * swapped for a real INSTANCE_SWAP once the icon library exists. Real
 * consumers pass their own icon via `children`, same as today. */
function PlaceholderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v18M3 12h18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

const meta = {
  title: 'ui/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    label: 'Ação',
    children: <PlaceholderIcon />,
    onClick: () => {},
  },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Disabled: Story = {
  args: { disabled: true },
}

/** Grade completa Variant x Size — espelha o frame "IconButton" (node 78:119) do Figma. */
export const VariantSizeMatrix: Story = {
  render: (args) => {
    const variants = ['primary', 'secondary', 'ghost'] as const
    const sizes = ['sm', 'md', 'lg'] as const
    return (
      <div className="icon-button-story-rows">
        {variants.map((variant) => (
          <div key={variant} className="icon-button-story-row">
            <span className="icon-button-story-row__label">{variant}</span>
            {sizes.map((size) => (
              <IconButton key={size} {...args} variant={variant} size={size} label={`${variant} ${size}`}>
                <PlaceholderIcon />
              </IconButton>
            ))}
          </div>
        ))}
      </div>
    )
  },
}

/** Estados por variante — Default/Disabled (Hover/Focus são interativos e não
 * podem ser fixados sem `:hover`/`:focus-visible` sintéticos). */
export const States: Story = {
  render: (args) => {
    const variants = ['primary', 'secondary', 'ghost'] as const
    return (
      <div className="icon-button-story-rows">
        {variants.map((variant) => (
          <div key={variant} className="icon-button-story-row">
            <span className="icon-button-story-row__label">{variant}</span>
            <IconButton {...args} variant={variant} label={`${variant} default`}>
              <PlaceholderIcon />
            </IconButton>
            <IconButton {...args} variant={variant} disabled label={`${variant} disabled`}>
              <PlaceholderIcon />
            </IconButton>
          </div>
        ))}
      </div>
    )
  },
}
