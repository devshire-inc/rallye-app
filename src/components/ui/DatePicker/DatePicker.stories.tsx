import { useArgs } from 'storybook/preview-api'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DatePicker, formatIsoLocal } from './DatePicker'

const TODAY_ISO = formatIsoLocal(new Date())

const meta = {
  title: 'ui/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text' },
    min: { control: 'text' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    busyDates: { control: 'object' },
  },
  args: {
    value: undefined,
    min: TODAY_ISO,
    size: 'md',
    busyDates: [],
  },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

/** Calendário de reserva (Figma node 47:6, "Mobile — Full-width") — o mesmo
 * conteúdo de grade serve o layout mobile full-width e o popover desktop
 * (node 72:2); só o `onChange` real permite testar seleção/teclado no
 * canvas do Storybook. */
export const Playground: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs()
    return (
      <div style={{ maxWidth: 360 }}>
        <DatePicker {...args} onChange={(value) => updateArgs({ value })} />
      </div>
    )
  },
}

/** sm/md/lg lado a lado — md (célula de 32px) é o valor exato do Figma;
 * sm/lg extrapolam pra baixo/cima já que o arquivo não define variantes de
 * tamanho dedicadas (ver DatePicker.css). */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} style={{ width: 300 }}>
          <p style={{ font: 'var(--type-label)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            {size}
          </p>
          <DatePicker
            size={size}
            value="2026-08-15"
            min="2026-01-01"
            busyDates={['2026-08-10', '2026-08-11', '2026-08-22']}
            onChange={() => {}}
          />
        </div>
      ))}
    </div>
  ),
}
