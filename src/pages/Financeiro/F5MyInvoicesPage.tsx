import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Icon } from '../../components/ui/Icon/Icon'
import { TableHeaderCell } from '../../components/ui/TableHeaderCell/TableHeaderCell'
import { TableRow } from '../../components/ui/TableRow/TableRow'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { listInvoices, type InvoiceListItem, type InvoiceStatus } from '../../lib/api/invoices'
import { daysUntilDue } from '../../lib/invoiceStatus'
import { formatBRL } from '../../lib/money'
import './Financeiro.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; invoices: InvoiceListItem[] }
type Tab = 'abertas' | 'pagas'

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/**
 * F5 — Minhas Faturas (Aluno) (BEAC-1950, story BEAC-1710). Markup segue o
 * doc real "F5 — Minhas Faturas (Aluno)" (Allye, ID
 * ddf76ca2-e14f-40b7-8eb5-889f366da68a): tabs Abertas/Pagas, agrupamento por
 * status com dias de atraso/vencimento, [PAGAR AGORA].
 *
 * Reaproveita GET /units/{id}/invoices (mesmo endpoint de F2/BEAC-1943) —
 * o backend já filtra pra "só as próprias faturas" quando o chamador não
 * tem financeiro:read (AC da story: "aluno vê apenas as próprias
 * faturas"), então esta tela não passa nenhum filtro de aluno explícito.
 *
 * Reskin design system (Figma "11 · Minhas Faturas — Aluno", node 159:1702
 * mobile / 186:2170 desktop / 187:2967 vazio): `Tabs` (Abertas/Pagas),
 * `EmptyState` (nenhuma fatura em aberto/paga), e um card local
 * (`InvoiceCard`, `.invoice-card*` em Financeiro.css) composto com `Badge`
 * (tom por status) e `Button` (ação "PAGAR AGORA"). `ChargeCard` (existente,
 * sem uso real até então) foi avaliado e descartado para este card: seu
 * layout (payer + linha desc/valor + linha status/ação lado a lado) não bate
 * com o card do Figma aqui, que é título+badge no topo, uma linha de
 * valor/data, uma linha de hint colorida e um botão full-width abaixo — o
 * mesmo agrupamento estrutural do card antigo, só retokenizado.
 *
 * Layout duplo (BEAC — paridade com o Figma desktop): o frame Desktop
 * (186:2170) troca os cards por uma tabela (DESCRIÇÃO/VALOR/DATA/STATUS +
 * coluna de ação), então esta tela renderiza os DOIS layouts e alterna por
 * CSS em `BREAKPOINT_SHELL_DESKTOP_MIN` (860px, src/lib/breakpoints.ts) —
 * mesmo mecanismo já usado por TrocarArenaPage (back button mobile vs
 * breadcrumb desktop) e pelo próprio AppShell (bottom-nav vs sidebar), em
 * vez de `matchMedia` em JS: sem flash de layout na primeira pintura e sem
 * depender de um stub de `matchMedia` fora do browser. É a primeira tela
 * real do app a usar `ui/TableRow`/`ui/TableHeaderCell`, montados num
 * `<table>` composto aqui — o DS não tem (de propósito) um componente
 * `Table` fechado, ver Table / Documentation (node 239:382).
 *
 * A tabela é plana (sem os headers de grupo "Atrasada"/"Pendente" do
 * mobile, que o frame desktop não mostra): a coluna STATUS já carrega essa
 * informação por linha. A ordenação do agrupamento é preservada — atrasadas
 * primeiro, depois pendentes.
 */
export default function F5MyInvoicesPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('abertas')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId) return
      listInvoices(unitId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', invoices: result.invoices })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const openInvoices = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.invoices.filter(
      (i) => i.status === 'atrasada' || i.status === 'gerada' || i.status === 'enviada',
    )
  }, [state])

  const overdue = useMemo(() => openInvoices.filter((i) => i.status === 'atrasada'), [openInvoices])
  const pending = useMemo(() => openInvoices.filter((i) => i.status !== 'atrasada'), [openInvoices])

  const paidInvoices = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.invoices
      .filter((i) => i.status === 'paga')
      .slice()
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
  }, [state])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <h1>Minhas Faturas</h1>
      </div>

      {/* `invoices-body`: a partir de 860px esta tela solta o
          `max-width: 560px` que `.dash-body` carrega globalmente (regra
          mobile-first replicada por várias páginas), senão a tabela do
          desktop caberia em ~512px num viewport de 1440 — metade da
          largura do frame 186:2170. Ver Financeiro.css. */}
      <div className="dash-body invoices-body">
        <Tabs
          tabs={['Abertas', 'Pagas']}
          value={tab === 'abertas' ? 'Abertas' : 'Pagas'}
          onChange={(next) => setTab(next === 'Abertas' ? 'abertas' : 'pagas')}
          ariaLabel="Filtrar faturas"
        />

        {state.status === 'loading' ? <p role="status">Carregando faturas…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar suas faturas.</p>
        ) : null}

        {state.status === 'ready' && tab === 'abertas' ? (
          openInvoices.length === 0 ? (
            <EmptyState
              icon={<Icon name="check-circle" size={40} />}
              title="Tudo em dia!"
              description="Nenhuma fatura pendente no momento."
            />
          ) : (
            <>
              <div className="invoices-cards">
                {overdue.length > 0 ? (
                  <>
                    <div className="group-header group-header--danger">Atrasada</div>
                    <div className="ag-list">
                      {overdue.map((invoice) => (
                        <InvoiceCard
                          key={invoice.id}
                          invoice={invoice}
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
                {pending.length > 0 ? (
                  <>
                    <div className="group-header group-header--warning">Pendente</div>
                    <div className="ag-list">
                      {pending.map((invoice) => (
                        <InvoiceCard
                          key={invoice.id}
                          invoice={invoice}
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              <InvoiceTable
                caption="Faturas em aberto"
                invoices={[...overdue, ...pending]}
                onSelect={(invoice) => navigate(`/invoices/${invoice.id}`)}
              />
            </>
          )
        ) : null}

        {state.status === 'ready' && tab === 'pagas' ? (
          paidInvoices.length === 0 ? (
            <EmptyState
              icon={<Icon name="receipt" size={40} />}
              title="Nenhum pagamento registrado"
              description="Suas faturas pagas vão aparecer aqui."
            />
          ) : (
            <>
              <div className="invoices-cards">
                <div className="ag-list">
                  {paidInvoices.map((invoice) => (
                    <InvoiceCard
                      key={invoice.id}
                      invoice={invoice}
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                    />
                  ))}
                </div>
              </div>
              <InvoiceTable
                caption="Faturas pagas"
                invoices={paidInvoices}
                onSelect={(invoice) => navigate(`/invoices/${invoice.id}`)}
              />
            </>
          )
        ) : null}
      </div>
    </AppShell>
  )
}

const INVOICE_BADGE_TONE: Record<InvoiceStatus, BadgeProps['tone']> = {
  paga: 'success',
  atrasada: 'danger',
  gerada: 'warning',
  enviada: 'warning',
  cancelada: 'neutral',
  estornada: 'info',
}

/** Coluna DATA da tabela desktop / trecho de data do card mobile —
 * "venceu 10/02/2026" (atrasada), "vence 10/03/2026" (em aberto),
 * "paga 08/01/2026". O Figma escreve a data curta (dd/MM); aqui vale o
 * `formatDate` completo já usado pelo card mobile, pra não esconder o ano
 * de faturas antigas (o mesmo dado, sem perda). */
function invoiceDateLabel(invoice: InvoiceListItem): string {
  if (invoice.status === 'paga') {
    return `paga ${invoice.paidAt ? formatDate(invoice.paidAt) : ''}`.trim()
  }
  return `${invoice.status === 'atrasada' ? 'venceu' : 'vence'} ${formatDate(invoice.dueDate)}`
}

const INVOICE_BADGE_LABEL: Record<InvoiceStatus, string> = {
  paga: '✓ Paga',
  atrasada: '● Atrasada',
  gerada: '● Pendente',
  enviada: '● Pendente',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
}

function InvoiceCard({ invoice, onClick }: { invoice: InvoiceListItem; onClick: () => void }) {
  const isPaid = invoice.status === 'paga'
  const isOverdue = invoice.status === 'atrasada'
  const days = daysUntilDue(invoice.dueDate)
  const daysLabel = isOverdue
    ? `Atraso: ${Math.abs(days)} dias`
    : days === 0
      ? 'Vence hoje'
      : `Vence em ${days} dias`
  const hintTone = isPaid ? 'success' : isOverdue ? 'danger' : 'warning'

  return (
    <div className="invoice-card">
      <button type="button" className="invoice-card__content" onClick={onClick}>
        <span className="invoice-card__top">
          <span className="invoice-card__title">{invoice.description}</span>
          <Badge tone={INVOICE_BADGE_TONE[invoice.status]}>
            {INVOICE_BADGE_LABEL[invoice.status]}
          </Badge>
        </span>
        <span className="invoice-card__desc">
          {formatBRL(invoice.amount)} · {invoiceDateLabel(invoice)}
        </span>
        <span className={`invoice-card__hint invoice-card__hint--${hintTone}`}>
          {isPaid ? `Pago via ${invoice.paymentMethod ?? 'método não informado'}` : daysLabel}
        </span>
      </button>
      {/* Abre F3 (não direto o payment_link): a listagem (BEAC-1943) não
          devolve payment_link — só o detalhe (BEAC-1944) tem esse dado. F3
          já mostra [PAGAR AGORA] apontando pro link real na visão Aluno,
          então este botão só navega pra lá em vez de duplicar a lógica de
          abrir o link sem tê-lo disponível aqui. */}
      {!isPaid ? (
        <Button variant="primary" size="md" fullWidth onClick={onClick}>
          PAGAR AGORA
        </Button>
      ) : null}
    </div>
  )
}

/** Rótulo de status sem os sinais gráficos do card mobile (●/✓) — o frame
 * desktop (186:3937/186:3949/186:3961) mostra só o texto dentro do Badge. */
const INVOICE_TABLE_BADGE_LABEL: Record<InvoiceStatus, string> = {
  paga: 'Paga',
  atrasada: 'Atrasada',
  gerada: 'Pendente',
  enviada: 'Pendente',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
}

/**
 * Tabela de faturas do desktop (Figma node 186:3918 "Tabela · Faturas"),
 * escondida abaixo de `BREAKPOINT_SHELL_DESKTOP_MIN` — ver `.invoice-table`
 * em Financeiro.css. Montada aqui com `TableHeaderCell` + `TableRow` do DS
 * (primeiro uso real dos dois): o Rallye DS não expõe um `<Table>` fechado,
 * a tabela é composta na tela (Table / Documentation, node 239:382), então
 * o `<table>`, o `<colgroup>` de larguras e os `<td>` são responsabilidade
 * deste caller — exatamente o que a story `ui/Table (assembled example)`
 * demonstra. Nenhum dos dois componentes precisou ser estendido.
 *
 * A linha inteira NÃO é clicável (mesma regra da story: o alvo de clique é
 * sempre o controle dentro da célula de ação, com foco próprio) — quem
 * navega pro detalhe é o botão "Pagar agora"/"Ver ›" da última coluna.
 */
function InvoiceTable({
  caption,
  invoices,
  onSelect,
}: {
  caption: string
  invoices: InvoiceListItem[]
  onSelect: (invoice: InvoiceListItem) => void
}) {
  return (
    <div className="invoice-table">
      <table className="invoice-table__table">
        <caption className="invoice-table__caption">{caption}</caption>
        <colgroup>
          <col className="invoice-table__col--desc" />
          <col className="invoice-table__col--amount" />
          <col className="invoice-table__col--date" />
          <col className="invoice-table__col--status" />
          <col className="invoice-table__col--action" />
        </colgroup>
        <thead>
          <tr>
            <TableHeaderCell>DESCRIÇÃO</TableHeaderCell>
            <TableHeaderCell>VALOR</TableHeaderCell>
            <TableHeaderCell>DATA</TableHeaderCell>
            <TableHeaderCell>STATUS</TableHeaderCell>
            {/* Coluna de ação: sem rótulo visível no Figma (node 186:3928),
                mas o `<th>` precisa de nome acessível pra leitores de tela. */}
            <TableHeaderCell>
              <span className="invoice-table__sr-only">Ação</span>
            </TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const isPaid = invoice.status === 'paga'
            return (
              <TableRow key={invoice.id}>
                <td className="invoice-table__desc">{invoice.description}</td>
                <td className="invoice-table__amount">{formatBRL(invoice.amount)}</td>
                <td className="invoice-table__date">{invoiceDateLabel(invoice)}</td>
                <td>
                  <Badge tone={INVOICE_BADGE_TONE[invoice.status]}>
                    {INVOICE_TABLE_BADGE_LABEL[invoice.status]}
                  </Badge>
                </td>
                <td className="invoice-table__action">
                  {/* Mesmo destino do card mobile (F3, `/invoices/{id}`): a
                      listagem não devolve payment_link, só o detalhe. */}
                  <Button variant="ghost" size="sm" onClick={() => onSelect(invoice)}>
                    {isPaid ? 'Ver ›' : 'Pagar agora'}
                    {/* Vírgula, e não " — ": o cálculo do nome acessível
                        apara o espaço das pontas de cada nó e concatena os
                        inline sem separador, então " — {desc}" produzia
                        "Pagar agora— Mensalidade julho" no leitor de tela
                        (o espaço à esquerda se perde; nbsp idem, porque
                        `trim()` também o remove). */}
                    <span className="invoice-table__sr-only">, {invoice.description}</span>
                  </Button>
                </td>
              </TableRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
