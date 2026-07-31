import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Pagination } from './Pagination'

const meta = {
  title: 'ui/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  argTypes: {
    page: { control: 'number' },
    totalPages: { control: 'number' },
    siblingCount: { control: 'number' },
  },
  args: {
    page: 1,
    totalPages: 9,
    onPageChange: () => {},
  },
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

/** Controles reais — clicar num número ou em ‹/› avança de verdade a página
 * ativa e o texto "Página N de M", em vez de só fixar `args.page`. */
export const Playground: Story = {
  render: (args) => {
    const [page, setPage] = useState(args.page)
    return (
      <Pagination
        {...args}
        page={page}
        onPageChange={(next) => {
          setPage(next)
          args.onPageChange?.(next)
        }}
      />
    )
  },
}

/** Primeira página — "Página anterior" desabilitado. */
export const FirstPage: Story = {
  args: { page: 1, totalPages: 9 },
}

/** Última página — "Próxima página" desabilitado. */
export const LastPage: Story = {
  args: { page: 9, totalPages: 9 },
}

/** Poucas páginas — sem truncamento, todos os números aparecem. */
export const FewPages: Story = {
  args: { page: 2, totalPages: 3 },
}
