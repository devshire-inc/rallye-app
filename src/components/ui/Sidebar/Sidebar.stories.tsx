import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Sidebar, type SidebarSection } from './Sidebar'
import './Sidebar.stories.css'

type SidebarArgs = ComponentProps<typeof Sidebar> & { active: string }

const meta = {
  title: 'ui/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Navegação lateral do admin web — Figma node 58:2. Painel flutuante: surface/card, radius/xl, Shadow/Float Nav, sem borda (o vão de 16px em volta é reservado pelo consumidor, mesma convenção do BottomNav). Estrutura: logo fixo · nav rolável com seções rotuladas (Overline/text-muted) · rodapé fixo com itens + Seletor de arena.',
      },
    },
  },
  argTypes: {
    active: { control: 'text' },
    sections: { control: 'object' },
    footerItems: { control: 'object' },
    arenaSelector: { control: false },
    logo: { control: false },
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

const SECTIONS: SidebarSection[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { icon: 'home', label: 'Início' },
      { icon: 'calendar', label: 'Agenda' },
      { icon: 'users', label: 'Turmas' },
      { icon: 'user', label: 'Alunos' },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      { icon: 'briefcase', label: 'Financeiro' },
      { icon: 'settings', label: 'Configurações' },
    ],
  },
]

function Logo() {
  return (
    <>
      <span className="sidebar-story-logo-mark" aria-hidden="true" />
      rallye
    </>
  )
}

function ArenaAvatar() {
  return <span className="sidebar-story-arena-mark" aria-hidden="true" />
}

function PlaygroundInner({ args }: { args: SidebarArgs }) {
  const [active, setActive] = useState(args.active)
  const [arenaClicks, setArenaClicks] = useState(0)

  return (
    <div className="sidebar-story-column">
      <div className="sidebar-story-frame">
        <Sidebar
          {...args}
          active={active}
          onChange={setActive}
          arenaSelector={
            args.arenaSelector && {
              ...args.arenaSelector,
              onClick: () => setArenaClicks((n) => n + 1),
            }
          }
        />
      </div>
      <p className="sidebar-story-note">Seletor de arena clicado: {arenaClicks}x</p>
    </div>
  )
}

/** args.active only seeds the initial selection — a real nav must own its
 * state so clicking an item in the Storybook canvas actually switches it.
 * `key={args.active}` remounts (re-seeding local state) whenever the
 * "active" Controls-panel value is edited, without fighting canvas clicks
 * (which change local state only, not args). Clicking "Arena Beira-Mar" is
 * wired to a real onClick too — the counter below the panel proves it,
 * since arena switching has no visual state of its own to point at. */
export const Playground: Story = {
  args: {
    logo: <Logo />,
    sections: SECTIONS,
    active: 'Início',
    footerItems: [{ icon: 'user-circle', label: 'Perfil' }],
    arenaSelector: {
      label: 'Arena Beira-Mar',
      action: 'Trocar arena',
      avatar: <ArenaAvatar />,
    },
  },
  render: (args) => <PlaygroundInner key={args.active} args={args as SidebarArgs} />,
}

function WithoutFooterInner({ args }: { args: SidebarArgs }) {
  const [active, setActive] = useState(args.active)
  return (
    <div className="sidebar-story-frame">
      <Sidebar {...args} active={active} onChange={setActive} />
    </div>
  )
}

/** Sem seletor de arena e sem rodapé — sidebar mínima, só nav. Também
 * totalmente interativa (mesmo padrão do Playground, incluindo o
 * `key={args.active}` que ressincroniza com o Controls panel). */
export const WithoutFooter: Story = {
  args: {
    logo: <Logo />,
    sections: SECTIONS,
    active: 'Agenda',
    footerItems: [],
  },
  render: (args) => <WithoutFooterInner key={args.active} args={args as SidebarArgs} />,
}
