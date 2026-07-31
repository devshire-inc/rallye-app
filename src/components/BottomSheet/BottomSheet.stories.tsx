import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../ui/Button/Button'
import { Input } from '../ui/Input/Input'
import { BottomSheet } from './BottomSheet'

const meta = {
  title: 'BottomSheet',
  component: BottomSheet,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
  },
  args: {
    label: 'Escolher data',
    open: false,
    onClose: () => {},
    children: null,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof BottomSheet>

export default meta
type Story = StoryObj<typeof meta>

/** Trigger + sheet driven by real state — clicking the trigger opens it,
 * clicking the ✕, the backdrop, or Escape closes it, exactly like a real
 * consumer would wire it up (embrulha conteúdo: ex. um formulário curto). */
export const Playground: Story = {
  render: (args) => {
    const [open, setOpen] = useState(args.open)
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Button onClick={() => setOpen(true)}>Escolher data</Button>
        <BottomSheet
          {...args}
          open={open}
          onClose={() => {
            setOpen(false)
            args.onClose?.()
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input label="Data" placeholder="dd/mm/aaaa" />
            <Input label="Horário" placeholder="hh:mm" />
            <Button onClick={() => setOpen(false)}>Confirmar</Button>
          </div>
        </BottomSheet>
      </div>
    )
  },
}

/** Sem `label` — só o handle e o botão de fechar, sem título no header. */
export const WithoutTitle: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true)
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Button onClick={() => setOpen(true)}>Abrir</Button>
        <BottomSheet {...args} label={undefined} open={open} onClose={() => setOpen(false)}>
          <p>Conteúdo (ex.: DatePicker, TimePicker ou formulário)</p>
        </BottomSheet>
      </div>
    )
  },
}
