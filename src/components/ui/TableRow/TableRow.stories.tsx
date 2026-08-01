import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from '../Avatar/Avatar'
import { Badge } from '../Badge/Badge'
import { IconButton } from '../IconButton/IconButton'
import { TableRow } from './TableRow'
import './TableRow.stories.css'

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.5-7.5-2.1 2.1M8.6 15.4l-2.1 2.1m0-11-2.1-2.1M17.5 19.5l-2.1-2.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Célula típica de nome + e-mail — mesmo padrão do exemplo de coluna real do
 * Figma (node 202:369), mas é só um exemplo: TableRow não prescreve colunas. */
function NameCell({ name, email }: { name: string; email: string }) {
  return (
    <td>
      <div className="table-row-story__name-cell">
        <Avatar name={name} size="sm" />
        <div className="table-row-story__name-col">
          <p className="table-row-story__name">{name}</p>
          <p className="table-row-story__email">{email}</p>
        </div>
      </div>
    </td>
  )
}

const meta = {
  title: 'ui/TableRow',
  component: TableRow,
  tags: ['autodocs'],
  argTypes: {
    hover: { control: 'boolean' },
    /* `undefined` = linha não selecionável (tabela estática) e nenhum
       `aria-selected` no `<tr>`; `false`/`true` = linha selecionável. Por
       isso o controle é radio com as três opções, e não um booleano — o
       default do componente é justamente a ausência do atributo. */
    selected: {
      control: 'radio',
      options: [undefined, false, true],
      labels: { undefined: 'undefined (não selecionável)', false: 'false', true: 'true' },
    },
  },
  args: {
    hover: false,
  },
  decorators: [
    (Story, context) => (
      /* `role="grid"` só quando a linha é selecionável: `aria-selected` não
         é válido em `role="row"` de tabela estática. Espelha a regra que o
         consumidor real precisa seguir. */
      <table
        className="table-row-story__table"
        role={
          context.args.selected !== undefined || context.parameters.selectable ? 'grid' : undefined
        }
      >
        <tbody>
          <Story />
        </tbody>
      </table>
    ),
  ],
} satisfies Meta<typeof TableRow>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <TableRow {...args}>
      <NameCell name="Bruno Fernandes" email="bruno@email.com" />
      <td>
        <Badge tone="success">Confirmada</Badge>
      </td>
      <td>
        <IconButton variant="secondary" label="Configurações">
          <GearIcon />
        </IconButton>
      </td>
    </TableRow>
  ),
}

/** State=Default|Hover|Selected — espelha o frame "Table Row" (node 202:369)
 * do Figma. Selected carrega os dois sinais exigidos pelo doc de a11y: a
 * barra esquerda visível e `aria-selected="true"` (inspecionável na aba
 * Accessibility do Storybook), nunca só o fundo.
 *
 * As duas primeiras linhas NÃO emitem `aria-selected` — o atributo só sai
 * quando `selected` é passado, porque em tabela estática (`role="row"` fora
 * de grid/treegrid) ele é inválido. Como esta story mostra uma linha
 * selecionada, a `<table>` do decorator assume `role="grid"`
 * (`parameters.selectable`), que é o que o consumidor real precisa fazer. */
export const States: Story = {
  parameters: { selectable: true },
  render: () => (
    <>
      <TableRow>
        <NameCell name="Bruno Fernandes" email="bruno@email.com" />
        <td>
          <Badge tone="success">Confirmada</Badge>
        </td>
        <td>
          <IconButton variant="secondary" label="Configurações">
            <GearIcon />
          </IconButton>
        </td>
      </TableRow>
      <TableRow hover>
        <NameCell name="Bruno Fernandes" email="bruno@email.com" />
        <td>
          <Badge tone="success">Confirmada</Badge>
        </td>
        <td>
          <IconButton variant="secondary" label="Configurações">
            <GearIcon />
          </IconButton>
        </td>
      </TableRow>
      <TableRow selected>
        <NameCell name="Bruno Fernandes" email="bruno@email.com" />
        <td>
          <Badge tone="success">Confirmada</Badge>
        </td>
        <td>
          <IconButton variant="secondary" label="Configurações">
            <GearIcon />
          </IconButton>
        </td>
      </TableRow>
    </>
  ),
}
