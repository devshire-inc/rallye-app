import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from '../Avatar/Avatar'
import { Badge, type BadgeProps } from '../Badge/Badge'
import { IconButton } from '../IconButton/IconButton'
import { Pagination } from '../Pagination/Pagination'
import { TableHeaderCell } from '../TableHeaderCell/TableHeaderCell'
import { TableRow } from '../TableRow/TableRow'
import './TableExample.stories.css'

/** Não existe um componente `<Table>` fechado no Rallye Design System — ver
 * Table / Documentation (Figma node 239:382): "a tabela é composta na
 * tela, o que permite qualquer número de colunas." Esta story é o único
 * lugar onde as três peças (TableHeaderCell, TableRow, Pagination) aparecem
 * juntas, montadas num `<table>` real pelo caller, com seleção de linha e
 * paginação genuinamente interativas. */

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

interface Student {
  id: string
  name: string
  email: string
  status: 'Confirmada' | 'Pendente' | 'Cancelada'
}

const STATUS_TONE: Record<Student['status'], BadgeProps['tone']> = {
  Confirmada: 'success',
  Pendente: 'warning',
  Cancelada: 'danger',
}

const STUDENTS: Student[] = [
  { id: '1', name: 'Bruno Fernandes', email: 'bruno@email.com', status: 'Confirmada' },
  { id: '2', name: 'Camila Souza', email: 'camila@email.com', status: 'Pendente' },
  { id: '3', name: 'Diego Alves', email: 'diego@email.com', status: 'Confirmada' },
  { id: '4', name: 'Elisa Prado', email: 'elisa@email.com', status: 'Cancelada' },
  { id: '5', name: 'Felipe Rocha', email: 'felipe@email.com', status: 'Confirmada' },
]

const PAGE_SIZE = STUDENTS.length
const TOTAL_ITEMS = 84
const TOTAL_PAGES = Math.ceil(TOTAL_ITEMS / PAGE_SIZE)

function AssembledTable() {
  const [selectedId, setSelectedId] = useState<string | null>(STUDENTS[0]!.id)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  return (
    <div className="table-example">
      <table className="table-example__table">
        <thead>
          <tr>
            <TableHeaderCell>Nome</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Ação</TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {STUDENTS.map((student) => (
            <TableRow
              key={student.id}
              selected={selectedId === student.id}
              hover={hoveredId === student.id && selectedId !== student.id}
              className="table-example__row"
            >
              {/* onMouseEnter/Leave só simula o Hover do Figma nesta demo — em
                  produção o :hover real do CSS já cobre o caso comum; o
                  estado explícito serve para realce programático (ex.:
                  navegação por teclado). Seleção nunca é a linha inteira:
                  o alvo de clique é sempre o IconButton, com foco próprio. */}
              <td
                onMouseEnter={() => setHoveredId(student.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="table-example__name-cell">
                  <Avatar name={student.name} size="sm" />
                  <div className="table-example__name-col">
                    <p className="table-example__name">{student.name}</p>
                    <p className="table-example__email">{student.email}</p>
                  </div>
                </div>
              </td>
              <td
                onMouseEnter={() => setHoveredId(student.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <Badge tone={STATUS_TONE[student.status]}>{student.status}</Badge>
              </td>
              <td
                onMouseEnter={() => setHoveredId(student.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <IconButton
                  variant="secondary"
                  label={
                    selectedId === student.id
                      ? `Desselecionar ${student.name}`
                      : `Selecionar ${student.name}`
                  }
                  onClick={() => setSelectedId((current) => (current === student.id ? null : student.id))}
                >
                  <GearIcon />
                </IconButton>
              </td>
            </TableRow>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={TOTAL_PAGES} onPageChange={setPage} />
    </div>
  )
}

const meta = {
  title: 'ui/Table (assembled example)',
  component: AssembledTable,
  tags: ['autodocs'],
} satisfies Meta<typeof AssembledTable>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}
