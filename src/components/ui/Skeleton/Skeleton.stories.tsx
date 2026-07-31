import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton, SkeletonGroup } from './Skeleton'

const meta = {
  title: 'ui/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'avatar', 'card', 'tableRow'],
    },
    lines: { control: 'number' },
  },
  args: {
    type: 'text',
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Type=Text (node 201:2) — 3 linhas de largura decrescente por padrão. */
export const Text: Story = {
  args: { type: 'text' },
}

/** Type=Text com `lines` customizado. */
export const TextWithMoreLines: Story = {
  args: { type: 'text', lines: 5 },
}

/** Type=Avatar (node 201:12) — círculo de 48px. */
export const Avatar: Story = {
  args: { type: 'avatar' },
}

/** Type=Card (node 201:16) — imagem 240x120 + 2 linhas de legenda. */
export const Card: Story = {
  args: { type: 'card' },
}

/** Type=TableRow (node 201:26) — mesma altura (56px) da Table Row real, pra
 * layout não pular quando o dado chegar. */
export const TableRow: Story = {
  args: { type: 'tableRow' },
}

/**
 * Composição sugerida pela documentação do Figma (node 240:91, "QUANDO
 * USAR"): "5 TableRow para uma tabela". O anúncio de carregamento aparece
 * uma única vez, via <SkeletonGroup>, não uma vez por linha.
 */
export const TableSkeleton: Story = {
  render: () => (
    <SkeletonGroup label="Carregando reservas">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} type="tableRow" />
        ))}
      </div>
    </SkeletonGroup>
  ),
}

/**
 * Composição sugerida pela documentação do Figma: "3 Card para um feed".
 * Mesmo padrão de anúncio único via <SkeletonGroup>.
 */
export const CardFeedSkeleton: Story = {
  render: () => (
    <SkeletonGroup label="Carregando eventos">
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} type="card" />
        ))}
      </div>
    </SkeletonGroup>
  ),
}
