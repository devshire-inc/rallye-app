import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArenaCard, type ArenaCardProps } from './ArenaCard'
import './ArenaCard.stories.css'

const meta = {
  title: 'ui/ArenaCard',
  component: ArenaCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Card de arena do seletor (login e troca de arena in-app) — Figma node 126:289. Reaproveita o ListRow (Avatar + Chevron) por dentro, com selo de papel e dots de esporte no rodapé.',
      },
    },
  },
  argTypes: {
    name: { control: 'text' },
    subtitle: { control: 'text' },
    avatarSrc: { control: 'text' },
    roles: { control: 'object' },
    roleTone: { control: 'select', options: ['success', 'warning', 'danger', 'info', 'brand', 'neutral'] },
    sports: { control: 'object' },
    onClick: { control: 'boolean' },
    disabled: { control: 'boolean' },
    testId: { control: 'text' },
  },
  args: {
    name: 'Arena Beira-Mar',
    subtitle: 'Rua das Palmeiras, 120',
    roles: ['Dono', 'Admin'],
    sports: ['beach_tennis', 'padel'],
  },
} satisfies Meta<typeof ArenaCard>

export default meta
type Story = StoryObj<typeof meta>

function PlaygroundInner(args: ArenaCardProps) {
  const [clicks, setClicks] = useState(0)
  return (
    <div className="arena-card-story-wrap">
      <ArenaCard {...args} onClick={args.onClick ? () => setClicks((n) => n + 1) : undefined} />
      {args.onClick ? <p className="arena-card-story-note">Clicado: {clicks}x</p> : null}
    </div>
  )
}

/** `onClick` no Storybook aceita `true`/`false` via control; quando `true` o
 * card renderiza como `<button>` e o contador abaixo prova que o clique é
 * real. */
export const Playground: Story = {
  render: (args) => <PlaygroundInner {...args} />,
}

/** Uso real: lista de arenas no seletor (login / troca in-app), cada card
 * selecionável. */
export const ArenaPickerList: Story = {
  render: () => {
    const arenas = [
      {
        name: 'Arena Beira-Mar',
        subtitle: 'Rua das Palmeiras, 120',
        roles: ['Dono', 'Admin'],
        sports: ['beach_tennis', 'padel'],
      },
      {
        name: 'Clube Vila Nova',
        subtitle: '32 membros',
        roles: ['Gestor'],
        sports: ['futevolei', 'volei', 'tenis'],
      },
      {
        name: 'Arena Central',
        subtitle: 'Av. Central, 500',
        roles: ['Professor'],
        sports: ['padel'],
      },
    ]
    const [selected, setSelected] = useState<string | null>(null)
    return (
      <div className="arena-card-story-list">
        {arenas.map((arena) => (
          <ArenaCard key={arena.name} {...arena} onClick={() => setSelected(arena.name)} />
        ))}
        {selected ? <p className="arena-card-story-note">Selecionada: {selected}</p> : null}
      </div>
    )
  },
}

/** Cores de selo por role (Figma node 43:1221/133:1145): Dono/Admin = verde
 * (`roleTone` default, "success"), Professor = azul (`roleTone="info"`). */
export const RoleTones: Story = {
  render: () => (
    <div className="arena-card-story-list">
      <ArenaCard name="Arena Beira-Mar" subtitle="Rua das Palmeiras, 120" roles={['Dono', 'Admin']} sports={['beach_tennis', 'padel']} />
      <ArenaCard name="Praia Norte Beach Club" subtitle="8 membros" roles={['Professor']} roleTone="info" sports={['padel', 'volei']} />
    </div>
  ),
}

/** Card desabilitado (ex.: os demais cards enquanto um deles está "entrando"
 * — troca de unit em progresso): opacidade reduzida, sem hover, sem clique. */
export const Disabled: Story = {
  args: {
    disabled: true,
    // Só a presença de `onClick` importa aqui — o PlaygroundInner troca por um
    // handler real (o contador). O control continua sendo booleano.
    onClick: () => {},
  },
  render: (args) => <PlaygroundInner {...args} />,
}
