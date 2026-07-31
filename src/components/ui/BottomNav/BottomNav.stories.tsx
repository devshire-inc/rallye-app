import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BottomNav, type BottomNavItem } from './BottomNav'
import './BottomNav.stories.css'

const meta = {
  title: 'ui/BottomNav',
  component: BottomNav,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Nav inferior flutuante (pilula) do Rallye — Figma node 33:2. Container: inset 16px das laterais, ~12px acima do home indicator, fill surface/card, Shadow/Float Nav, sem borda. Itens dividem a largura disponível igualmente (layoutSizingHorizontal=FILL) e o item ativo ganha uma cápsula alpha/orange-14 com ícone/rótulo em text/on-brand-soft.',
      },
    },
  },
} satisfies Meta<typeof BottomNav>

export default meta
type Story = StoryObj<typeof meta>

const FIVE_ITEMS: BottomNavItem[] = [
  { icon: 'home', label: 'Início' },
  { icon: 'calendar', label: 'Agenda' },
  { icon: 'trophy', label: 'Turmas' },
  { icon: 'bag', label: 'Alunos' },
  { icon: 'user', label: 'Perfil' },
]

const FOUR_ITEMS: BottomNavItem[] = [
  { icon: 'home', label: 'Início' },
  { icon: 'calendar', label: 'Agenda' },
  { icon: 'trophy', label: 'Torneios' },
  { icon: 'user', label: 'Perfil' },
]

const THREE_ITEMS: BottomNavItem[] = [
  { icon: 'home', label: 'Início' },
  { icon: 'calendar', label: 'Agenda' },
  { icon: 'user', label: 'Perfil' },
]

/** Interativo — clicar num item troca o estado ativo de verdade (não é só decorativo). */
export const Playground: Story = {
  args: {
    items: FIVE_ITEMS,
    active: FIVE_ITEMS[0]!.label,
  },
  render: (args) => {
    function PlaygroundInner() {
      const [active, setActive] = useState(args.active)
      return (
        <div className="bottom-nav-story-frame">
          <div className="bottom-nav-story-dock">
            <BottomNav items={args.items} active={active} onChange={setActive} />
          </div>
        </div>
      )
    }
    return <PlaygroundInner />
  },
}

/** BottomNav (example) — 5 itens, node Figma 83:15. */
export const FiveItems: Story = {
  render: () => (
    <div className="bottom-nav-story-frame">
      <div className="bottom-nav-story-dock">
        <BottomNav items={FIVE_ITEMS} active="Início" onChange={() => {}} />
      </div>
    </div>
  ),
}

/** Professor (4 itens — sem Alunos), node Figma 134:49. */
export const FourItems: Story = {
  render: () => (
    <div className="bottom-nav-story-frame">
      <div className="bottom-nav-story-dock">
        <BottomNav items={FOUR_ITEMS} active="Agenda" onChange={() => {}} />
      </div>
    </div>
  ),
}

/** Aluno (3 itens — sem Turmas/Alunos), node Figma 134:75. */
export const ThreeItems: Story = {
  render: () => (
    <div className="bottom-nav-story-frame">
      <div className="bottom-nav-story-dock">
        <BottomNav items={THREE_ITEMS} active="Perfil" onChange={() => {}} />
      </div>
    </div>
  ),
}
