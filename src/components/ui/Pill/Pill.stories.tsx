import type { Meta, StoryObj } from '@storybook/react-vite'
import { Pill } from './Pill'

const meta = {
  title: 'ui/Pill',
  component: Pill,
  tags: ['autodocs'],
} satisfies Meta<typeof Pill>

export default meta
type Story = StoryObj<typeof meta>

/** Uso típico: rótulo "DEMO" em destaque + o código de verificação. */
export const DemoCode: Story = {
  render: () => (
    <Pill>
      <b>DEMO</b> 123456
    </Pill>
  ),
}

/** Texto simples, sem parte em destaque. */
export const PlainText: Story = {
  render: () => <Pill>Reenviar código em 60s</Pill>,
}
