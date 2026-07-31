import type { Meta, StoryObj } from '@storybook/react-vite'
import { TableHeaderCell } from './TableHeaderCell'

const meta = {
  title: 'ui/TableHeaderCell',
  component: TableHeaderCell,
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text' },
  },
  args: {
    children: 'Nome',
  },
  decorators: [
    (Story) => (
      <table>
        <thead>
          <tr>
            <Story />
          </tr>
        </thead>
      </table>
    ),
  ],
} satisfies Meta<typeof TableHeaderCell>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Cabeçalho completo — espelha o frame "Table Header Cell" (node 202:2) do
 * Figma repetido em várias colunas, como usado na Assembled Table story. */
export const HeaderRow: Story = {
  render: () => (
    <>
      <TableHeaderCell>Nome</TableHeaderCell>
      <TableHeaderCell>Status</TableHeaderCell>
      <TableHeaderCell>Ação</TableHeaderCell>
    </>
  ),
}
