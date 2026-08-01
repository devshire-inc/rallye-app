import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageLoading } from './PageLoading'

const meta = {
  title: 'ui/PageLoading',
  component: PageLoading,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['page', 'section', 'list', 'field'],
    },
    rows: { control: 'number' },
  },
  args: {
    label: 'Carregando horários',
    variant: 'page',
  },
} satisfies Meta<typeof PageLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/**
 * Variant=page (node 187:7216) — pilha completa: título, filtro, destaque e a
 * grade de 2 colunas. Usado quando o skeleton ocupa o corpo inteiro da tela,
 * dentro do AppShell/AuthLayout normal (o chrome continua visível).
 */
export const Page: Story = {
  args: { variant: 'page' },
}

/**
 * Variant=section — sem o bloco de título, para telas cujo header real já está
 * renderizado e só o miolo está carregando.
 */
export const Section: Story = {
  args: { variant: 'section', label: 'Carregando faturas' },
}

/**
 * Variant=list — TableRow repetido, a composição que a doc do Figma sugere
 * (node 240:91) quando a forma do conteúdo é uma lista/tabela.
 */
export const List: Story = {
  args: { variant: 'list', label: 'Carregando membros' },
}

/**
 * Variant=field — um bloco só, com a altura de um controle de formulário,
 * para quando o que carrega é um campo dentro de um sheet e não a página.
 */
export const Field: Story = {
  args: { variant: 'field', label: 'Carregando quadras' },
}

/** Grade mais longa, para telas com muito conteúdo abaixo da dobra. */
export const MoreRows: Story = {
  args: { rows: 4 },
}
