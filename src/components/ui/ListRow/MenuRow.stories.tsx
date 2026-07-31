import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MenuRow } from './MenuRow'
import './MenuRow.stories.css'

const meta = {
  title: 'ui/ListRow/MenuRow',
  component: MenuRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Linha de menu do Perfil — Figma node 96:52. Ícone opcional + rótulo à esquerda; chevron de navegação à direita, ou um valor de texto (ex. "Ativado") quando a linha só exibe estado.',
      },
    },
  },
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    onClick: { control: 'boolean' },
    icon: { control: false },
  },
  args: {
    label: 'Editar perfil',
    value: undefined,
  },
} satisfies Meta<typeof MenuRow>

export default meta
type Story = StoryObj<typeof meta>

function PlaygroundInner(args: Story['args']) {
  const [clicks, setClicks] = useState(0)
  return (
    <div className="menu-row-story-wrap">
      <MenuRow {...args} onClick={args?.onClick ? () => setClicks((n) => n + 1) : undefined} />
      {args?.onClick ? <p className="menu-row-story-note">Clicado: {clicks}x</p> : null}
    </div>
  )
}

/** `onClick` no Storybook aceita `true`/`false` via control; o contador
 * abaixo prova que o clique é real, já que a linha não tem estado visual
 * próprio para apontar. */
export const Playground: Story = {
  render: (args) => <PlaygroundInner {...args} />,
}

/** Menu de Perfil típico: linhas de navegação (chevron) intercaladas com uma
 * linha de estado (valor à direita), como descrito na documentação do
 * Figma ("Notificações" → "Ativado"). */
export const ProfileMenu: Story = {
  render: () => (
    <div className="menu-row-story-list">
      <MenuRow label="Editar perfil" onClick={() => {}} />
      <MenuRow label="Notificações" value="Ativado" onClick={() => {}} />
      <MenuRow label="Privacidade" onClick={() => {}} />
      <MenuRow label="Sair" />
    </div>
  ),
}
