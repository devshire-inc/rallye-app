import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinkCard } from './LinkCard'

const meta = {
  title: 'ui/LinkCard',
  component: LinkCard,
  tags: ['autodocs'],
  argTypes: {
    link: { control: 'text' },
    copyLabel: { control: 'text' },
    copiedLabel: { control: 'text' },
    copiedTimeout: { control: 'number' },
  },
  args: {
    link: 'pay.rallye.com.br/c/8f2k91a',
    copyLabel: 'Copiar',
    copiedLabel: 'Copiado!',
    copiedTimeout: 2000,
  },
} satisfies Meta<typeof LinkCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Clique em "Copiar" chama `navigator.clipboard.writeText` de verdade e
 * alterna o rótulo do botão para `copiedLabel` por `copiedTimeout`ms (Figma
 * node 102:37 — Button Soft/Small "Copiar").
 */
export const Playground: Story = {
  render: (args) => <LinkCard {...args} />,
}

/** Link longo o suficiente para testar o truncamento com ellipsis. */
export const LongLink: Story = {
  args: { link: 'pay.rallye.com.br/checkout/assinaturas/mensal-2x-semana/8f2k91a-cobranca-2026' },
}
