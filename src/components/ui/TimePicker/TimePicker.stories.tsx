import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TimePicker } from './TimePicker'

const meta = {
  title: 'ui/TimePicker',
  component: TimePicker,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text' },
    start: { control: 'text' },
    end: { control: 'text' },
    step: { control: 'number' },
    columns: { control: 'number' },
    variant: { control: 'select', options: ['grid', 'wheel'] },
    layout: { control: 'select', options: ['grid', 'grouped', 'list'] },
    busy: { control: 'object' },
    few: { control: 'object' },
    prices: { control: 'object' },
  },
  args: {
    value: undefined,
    start: '07:00',
    end: '12:00',
    step: 30,
    variant: 'grid',
    layout: 'grid',
    busy: ['08:00', '08:30'],
    few: ['09:00'],
    prices: {
      '07:00': 'R$ 100',
      '07:30': 'R$ 100',
      '08:00': 'R$ 100',
      '08:30': 'R$ 100',
      '09:00': 'R$ 120',
      '09:30': 'R$ 120',
      '10:00': 'R$ 120',
      '10:30': 'R$ 120',
      '11:00': 'R$ 120',
      '11:30': 'R$ 120',
      '12:00': 'R$ 120',
    },
  },
} satisfies Meta<typeof TimePicker>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Todos os controles do painel Controls são realmente aplicados: `value` é
 * mantido em `useState` local e amarrado ao `onChange` real do componente, e
 * o restante dos args (variant, layout, columns, busy, few, prices…) é
 * repassado direto — cada mudança no painel força um novo render.
 */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return (
      <div style={{ maxWidth: 480 }}>
        <TimePicker {...args} value={value} onChange={setValue} />
      </div>
    )
  },
}

/** Os quatro estados do TimePicker Slot (Figma node 262:38) lado a lado, nos dois layouts — Chip (Grid) e Row (Grouped/List). */
export const States: Story = {
  render: () => {
    const [gridValue, setGridValue] = useState<string | undefined>('09:30')
    const [rowValue, setRowValue] = useState<string | undefined>('09:30')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 480 }}>
        <div>
          <p style={{ font: 'var(--type-label)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            Layout=Chip (Grid) — Available / Selected / Few / Unavailable
          </p>
          <TimePicker
            start="09:00"
            end="10:30"
            step={30}
            value={gridValue}
            onChange={setGridValue}
            few={['10:00']}
            busy={['10:30']}
            prices={{ '09:00': 'R$ 120', '09:30': 'R$ 120', '10:00': 'R$ 120', '10:30': 'R$ 120' }}
          />
        </div>
        <div>
          <p style={{ font: 'var(--type-label)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            Layout=Row (List) — Available / Selected / Few / Unavailable
          </p>
          <TimePicker
            layout="list"
            start="09:00"
            end="10:30"
            step={30}
            value={rowValue}
            onChange={setRowValue}
            few={['10:00']}
            busy={['10:30']}
            prices={{ '09:00': 'R$ 120', '09:30': 'R$ 120', '10:00': 'R$ 120', '10:30': 'R$ 120' }}
          />
        </div>
      </div>
    )
  },
}

/** Layout=Grouped — arena das 9h às 23h a cada 30min, dividida em Manhã/Tarde/Noite. */
export const Grouped: Story = {
  render: () => {
    const [value, setValue] = useState<string | undefined>()
    return (
      <div style={{ maxWidth: 420 }}>
        <TimePicker
          layout="grouped"
          start="09:00"
          end="23:00"
          step={30}
          value={value}
          onChange={setValue}
          busy={['14:00', '14:30', '20:00']}
          few={['09:30', '18:30']}
        />
      </div>
    )
  },
}

/** Layout=List — cabeçalhos de período fixos (sticky) sobre uma lista rolável de linhas. */
export const List: Story = {
  render: () => {
    const [value, setValue] = useState<string | undefined>()
    return (
      <div style={{ maxWidth: 420, maxHeight: 480, overflowY: 'auto' }}>
        <TimePicker
          layout="list"
          start="09:00"
          end="23:00"
          step={30}
          value={value}
          onChange={setValue}
          busy={['14:00', '14:30', '20:00']}
          few={['09:30', '18:30']}
          prices={{ '09:30': 'R$ 90', '18:30': 'R$ 150' }}
        />
      </div>
    )
  },
}

/** `variant="wheel"` — o seletor nativo por `<select>`, preservado como estava (não faz parte deste recorte do Figma). */
export const Wheel: Story = {
  render: () => {
    const [value, setValue] = useState<string | undefined>()
    return (
      <TimePicker
        variant="wheel"
        start="07:00"
        end="20:00"
        step={30}
        value={value}
        onChange={setValue}
        busy={['08:00', '08:30']}
      />
    )
  },
}
