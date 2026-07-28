import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import { Input } from '../../components/ui/Input/Input'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { listInvoices, type InvoiceListItem, type InvoiceStatus } from '../../lib/api/invoices'
import { STATUS_LABEL } from '../../lib/invoiceStatus'
import { formatBRL } from '../../lib/money'
import './Financeiro.css'
import '../../components/AuthLayout/AuthLayout.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; invoices: InvoiceListItem[]; total: number }

type TabFilter = 'todas' | 'pendentes' | 'atrasadas' | 'pagas'

const TAB_TO_STATUS: Record<Exclude<TabFilter, 'todas' | 'pendentes'>, InvoiceStatus> = {
  atrasadas: 'atrasada',
  pagas: 'paga',
}

/** Mesmo mapeamento de src/lib/invoiceStatus.ts (statusBadgeClass), como
 * `tone` de ui/Badge em vez de classe CSS crua — mesmo padrão de
 * STATUS_BADGE_TONE em TeachersListPage.tsx/StudentProfilePage.tsx. Não
 * altera invoiceStatus.ts (statusBadgeClass ainda é usado por
 * F5MyInvoicesPage.tsx e PL4MySubscriptionPage.tsx, fora do escopo desta
 * task). */
const STATUS_BADGE_TONE: Record<InvoiceStatus, BadgeProps['tone']> = {
  gerada: 'neutral',
  enviada: 'warning',
  paga: 'success',
  atrasada: 'danger',
  cancelada: 'neutral',
  estornada: 'info',
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/**
 * F2 — Lista de Faturas (Admin) (BEAC-1947, story BEAC-1710). Markup/copy
 * seguem o doc real "F2 — Lista de Faturas (Admin)" (Allye, ID
 * 7698c394-a986-4851-8939-bc35c03b9be8): tabs de status, filtro por mês,
 * lista com badge de status + dias de atraso, total no rodapé, [+] -> F4.
 *
 * GAP CONHECIDO (aceito, não inventado, ver comentário de pacote de
 * TurmasListPage.tsx para o mesmo padrão): o doc real lista "swipe left em
 * fatura pendente -> Enviar lembrete" como ação rápida, mas BEAC-1941 (story
 * BEAC-1710, wave 2) só implementa o CRON automático de lembretes — nenhuma
 * task desta dispatch adiciona um endpoint HTTP para disparar um lembrete
 * avulso sob demanda. A ação foi omitida aqui (não fabricada contra um
 * endpoint inexistente) — mesma decisão em F3InvoiceDetailPage (botão
 * "Enviar lembrete" do Admin, também ausente).
 *
 * Busca por nome (🔍 no doc) filtra CLIENT-SIDE sobre a página já
 * carregada — GET /units/{id}/invoices (BEAC-1943) não tem parâmetro de
 * busca textual no AC, só status/month.
 */
export default function F2InvoiceListPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabFilter>('todas')
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7))
  const [query, setQuery] = useState('')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId) return
      const statusFilter = tab === 'atrasadas' || tab === 'pagas' ? TAB_TO_STATUS[tab] : undefined
      listInvoices(unitId, { status: statusFilter, month })
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', invoices: result.invoices, total: result.total })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, tab, month],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  // Tab "Pendentes" não é filtrada pelo backend (status=gerada OU
  // status=enviada, o backend só aceita 1 status por vez) — filtrada
  // client-side sobre "Todas" (sem status no request).
  const visibleInvoices = useMemo(() => {
    if (state.status !== 'ready') return []
    let list = state.invoices
    if (tab === 'pendentes') {
      list = list.filter((i) => i.status === 'gerada' || i.status === 'enviada')
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((i) => i.studentName.toLowerCase().includes(q))
    }
    return list
  }, [state, tab, query])

  const visibleTotal = useMemo(
    () => visibleInvoices.reduce((sum, i) => sum + i.amount, 0),
    [visibleInvoices],
  )

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to={unitId ? `/units/${unitId}/cashflow` : '#'}>
          ‹ Fluxo de Caixa
        </Link>
        <h1>Faturas</h1>
        <div className="spacer" />
        <div className="searchbar">
          <Input
            type="text"
            placeholder="Buscar aluno..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            ariaLabel="Buscar aluno"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => unitId && navigate(`/units/${unitId}/invoices/new`)}
        >
          + Nova cobrança
        </button>
      </div>

      <div className="dash-body">
        <div className="tabs2" role="group" aria-label="Filtrar por status">
          {(['todas', 'pendentes', 'atrasadas', 'pagas'] as TabFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? 'active' : ''}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t === 'todas' && 'Todas'}
              {t === 'pendentes' && 'Pendentes'}
              {t === 'atrasadas' && 'Atrasadas'}
              {t === 'pagas' && 'Pagas'}
            </button>
          ))}
        </div>

        <input
          type="month"
          className="month-select"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Filtrar por mês"
        />

        {state.status === 'loading' ? <p role="status">Carregando faturas…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar as faturas desta arena.</p>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <div className="ag-list">
              {visibleInvoices.length === 0 ? (
                <p className="hint">Nenhuma fatura encontrada.</p>
              ) : (
                visibleInvoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    className="inv-row"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    data-testid={`invoice-row-${invoice.id}`}
                  >
                    <span className="iw">
                      <span className="nm">{invoice.studentName}</span>
                      <span className="desc">{invoice.description}</span>
                    </span>
                    <span className="tail">
                      <span className="amt">{formatBRL(invoice.amount)}</span>
                      <span className="due">
                        {invoice.status === 'paga' && invoice.paidAt
                          ? `Pago ${formatDate(invoice.paidAt.slice(0, 10))}`
                          : `Vence ${formatDate(invoice.dueDate)}`}
                      </span>
                      <Badge tone={STATUS_BADGE_TONE[invoice.status]}>
                        {STATUS_LABEL[invoice.status]}
                        {invoice.status === 'atrasada' && invoice.daysOverdue != null
                          ? ` · ${invoice.daysOverdue} dias`
                          : ''}
                      </Badge>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="list-total">
              Total: {formatBRL(visibleTotal)} · {visibleInvoices.length}{' '}
              {visibleInvoices.length === 1 ? 'fatura' : 'faturas'}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
