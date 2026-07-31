import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'
import './Button.stories.css'

const meta = {
  title: 'ui/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'soft'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
    children: 'Button',
    onClick: () => {},
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Disabled: Story = {
  args: { disabled: true },
}

export const Loading: Story = {
  args: { loading: true },
}

export const FullWidth: Story = {
  args: { fullWidth: true },
}

/** Grade completa Variant x Size — espelha o frame "Button" (node 19:54) do Figma. */
export const VariantSizeMatrix: Story = {
  render: (args) => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'soft'] as const
    const sizes = ['sm', 'md', 'lg'] as const
    return (
      <div className="button-story-rows">
        {variants.map((variant) => (
          <div key={variant} className="button-story-row">
            <span className="button-story-row__label">{variant}</span>
            {sizes.map((size) => (
              <Button key={size} {...args} variant={variant} size={size}>
                {size.toUpperCase()}
              </Button>
            ))}
          </div>
        ))}
      </div>
    )
  },
}

/** Estados por variante — Default/Hover/Disabled/Loading (Hover/Pressed/Focus
 * são interativos e não podem ser fixados sem `:hover`/`:active` sintéticos). */
export const States: Story = {
  render: (args) => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'soft'] as const
    return (
      <div className="button-story-rows">
        {variants.map((variant) => (
          <div key={variant} className="button-story-row">
            <span className="button-story-row__label">{variant}</span>
            <Button {...args} variant={variant}>
              Default
            </Button>
            <Button {...args} variant={variant} disabled>
              Disabled
            </Button>
            <Button {...args} variant={variant} loading>
              Loading
            </Button>
          </div>
        ))}
      </div>
    )
  },
}
