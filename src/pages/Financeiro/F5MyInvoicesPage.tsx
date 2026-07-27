import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { listInvoices, type InvoiceListItem } from '../../lib/api/invoices'
import { daysUntilDue } from '../../lib/invoiceStatus'
import { formatBRL } from '../../lib/money'
import './Financeiro.css'
import '../../components/AuthLayout/AuthLayout.css'

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

      <div className="dash-body">
        <div className="tabs2" role="group" aria-label="Filtrar faturas">
          <button
            type="button"
            className={tab === 'abertas' ? 'active' : ''}
            onClick={() => setTab('abertas')}
          >
            Abertas
          </button>
          <button
            type="button"
            className={tab === 'pagas' ? 'active' : ''}
            onClick={() => setTab('pagas')}
          >
            Pagas
          </button>
        </div>

        {state.status === 'loading' ? <p role="status">Carregando faturas…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar suas faturas.</p>
        ) : null}

        {state.status === 'ready' && tab === 'abertas' ? (
          openInvoices.length === 0 ? (
            <p className="empty-state">Tudo em dia! ✅ Nenhuma fatura pendente.</p>
          ) : (
            <>
              {overdue.length > 0 ? (
                <>
                  <div className="group-header">🔴 Atrasada</div>
                  <div className="ag-list">
                    {overdue.map((invoice) => (
                      <MyInvoiceCard
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
                  <div className="group-header">🟡 Pendente</div>
                  <div className="ag-list">
                    {pending.map((invoice) => (
                      <MyInvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )
        ) : null}

        {state.status === 'ready' && tab === 'pagas' ? (
          paidInvoices.length === 0 ? (
            <p className="empty-state">Nenhum pagamento registrado ainda.</p>
          ) : (
            <div className="ag-list">
              {paidInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  className="inv-row"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                >
                  <span className="iw">
                    <span className="nm">{invoice.description}</span>
                    <span className="desc">
                      {formatBRL(invoice.amount)} · Paga{' '}
                      {invoice.paidAt ? formatDate(invoice.paidAt) : ''}
                    </span>
                  </span>
                  <span className="tail">
                    <span className="badge b-success">✅ {invoice.paymentMethod ?? 'Pago'}</span>
                  </span>
                </button>
              ))}
            </div>
          )
        ) : null}
      </div>
    </AppShell>
  )
}

function MyInvoiceCard({ invoice, onClick }: { invoice: InvoiceListItem; onClick: () => void }) {
  const days = daysUntilDue(invoice.dueDate)
  const isOverdue = invoice.status === 'atrasada'
  const daysLabel = isOverdue
    ? `Atraso: ${Math.abs(days)} dias`
    : days === 0
      ? 'Vence hoje'
      : `Vence em ${days} dias`

  return (
    <div className="card">
      <div
        className="iw"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick()
        }}
      >
        <span className="nm">{invoice.description}</span>
        <span className="desc">
          {formatBRL(invoice.amount)} · {isOverdue ? 'Venceu' : 'Vence'}{' '}
          {invoice.dueDate.split('-').reverse().slice(0, 2).join('/')}
        </span>
        <span
          className="hint"
          style={{ color: isOverdue ? 'var(--error-fg)' : 'var(--warning-fg)' }}
        >
          {daysLabel}
        </span>
      </div>
      {/* Abre F3 (não direto o payment_link): a listagem (BEAC-1943) não
          devolve payment_link — só o detalhe (BEAC-1944) tem esse dado. F3
          já mostra [PAGAR AGORA] apontando pro link real na visão Aluno,
          então este botão só navega pra lá em vez de duplicar a lógica de
          abrir o link sem tê-lo disponível aqui. */}
      <button type="button" className="btn btn-primary btn-sm btn-full" onClick={onClick}>
        PAGAR AGORA
      </button>
    </div>
  )
}
