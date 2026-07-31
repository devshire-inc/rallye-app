import type { Meta, StoryObj } from '@storybook/react-vite'
import { WaitlistCard } from './WaitlistCard'

const meta = {
  title: 'ui/WaitlistCard',
  component: WaitlistCard,
  tags: ['autodocs'],
  argTypes: {
    state: {
      control: 'select',
      options: ['aguardando', 'vaga-disponivel', 'expirado'],
    },
    position: { control: 'number' },
    title: { control: 'text' },
  },
  args: {
    state: 'aguardando',
    position: 3,
    title: 'Aula de Padel — Quarta 19h',
  },
} satisfies Meta<typeof WaitlistCard>

export default meta
type Story = StoryObj<typeof meta>

/** state=vaga-disponivel usa um expiresAt real ~8min no futuro — o countdown
 * ("Restam N minutos") tica de verdade a cada minuto via setInterval interno,
 * não uma string estática passada pelo caller. */
export const Playground: Story = {
  args: {
    state: 'vaga-disponivel',
    position: 1,
    expiresAt: new Date(Date.now() + 8 * 60_000 + 30_000).toISOString(),
  },
}

export const States: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WaitlistCard state="aguardando" position={3} title="Aula de Padel — Quarta 19h" />
      <WaitlistCard
        state="vaga-disponivel"
        position={1}
        title="Aula de Padel — Quarta 19h"
        expiresAt={new Date(Date.now() + 4 * 60_000 + 30_000).toISOString()}
        onReserve={() => {}}
      />
      <WaitlistCard state="expirado" title="Aula de Padel — Quarta 19h" />
    </div>
  ),
}
