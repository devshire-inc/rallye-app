import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import { Input } from '../../components/ui/Input/Input'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { Toast } from '../../components/Toast'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../hooks/useToast'
import {
  cancelInvoice,
  getInvoice,
  refundInvoice,
  registerManualPayment,
  type InvoiceDetail,
  type RefundType,
} from '../../lib/api/invoices'
import { STATUS_LABEL } from '../../lib/invoiceStatus'
import { formatBRL } from '../../lib/money'
import './Financeiro.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import '../../components/AuthLayout/AuthLayout.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; invoice: InvoiceDetail }

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

const EVENT_LABEL: Record<string, string> = {
  gerada: 'Fatura gerada',
  link_enviado: 'Link de pagamento enviado',
  atrasada: 'Fatura marcada como atrasada',
  lembrete_enviado: 'Lembrete enviado',
  paga: 'Pagamento registrado',
  cancelada: 'Fatura cancelada',
  estornada: 'Fatura estornada',
}

/** Mesmo mapeamento de src/lib/invoiceStatus.ts (statusBadgeClass), como
 * `tone` de ui/Badge em vez de classe CSS crua — mesmo padrão de
 * STATUS_BADGE_TONE em TeachersListPage.tsx/StudentProfilePage.tsx. Não
 * altera invoiceStatus.ts (statusBadgeClass ainda é usado por
 * F5MyInvoicesPage.tsx e PL4MySubscriptionPage.tsx, fora do escopo desta
 * task). */
const STATUS_BADGE_TONE: Record<InvoiceDetail['status'], BadgeProps['tone']> = {
  gerada: 'neutral',
  enviada: 'warning',
  paga: 'success',
  atrasada: 'danger',
  cancelada: 'neutral',
  estornada: 'info',
}

/**
 * F3 — Detalhe da Fatura (BEAC-1948, story BEAC-1710). Markup segue o doc
 * real "F3 — Detalhe da Fatura" (Allye, ID e35c608b-3863-4f36-8188-7b50f66d599d):
 * badge de status, card de dados, link de pagamento + copiar, timeline.
 *
 * Visão Admin vs Aluno: decidida por usePermission('financeiro','write') —
 * "esconder sempre, nunca desabilitar" (usePermission.ts). O backend
 * (GetHandler, BEAC-1944) já garante que só o próprio aluno OU alguém com
 * financeiro:read consegue sequer carregar esta página (403 senão) — o que
 * usePermission decide aqui é só QUAIS AÇÕES aparecem, nunca visibilidade
 * dos dados em si (que já vieram autorizados do backend).
 *
 * GAP CONHECIDO (aceito, não fabricado — ver mesmo comentário em
 * F2InvoiceListPage.tsx): o botão Admin "[ENVIAR LEMBRETE]" do doc real foi
 * omitido — BEAC-1941 só implementa o cron automático, sem endpoint HTTP
 * para lembrete avulso sob demanda.
 *
 * "[ESTORNAR]" (BEAC-1952, story BEAC-1711): sheet `#sheet-estorno` do
 * protótipo real (Artifact "Rallye — Financeiro · Saque Noturno") reproduzida
 * abaixo — subtítulo com dados da fatura, tabs Total/Parcial, campo de valor
 * só em Parcial, toast explicando a regra (cópia exata do protótipo) e botão
 * de confirmação danger. Chama POST /invoices/{id}/refund (BEAC-1951).
 */
export default function F3InvoiceDetailPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const canManage = usePermission('financeiro', 'write')
  const { message, variant, showError, showSuccess, dismiss } = useToast()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [showRefundSheet, setShowRefundSheet] = useState(false)
  const [refundType, setRefundType] = useState<RefundType>('total')
  const [refundAmount, setRefundAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copyLabel, setCopyLabel] = useState('COPIAR')

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request = invoiceId
        ? getInvoice(invoiceId)
        : Promise.reject(new Error('missing_invoice_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', invoice: result.invoice })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [invoiceId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handleManualPayment() {
    if (!invoiceId || paymentMethod.trim() === '') return
    setSubmitting(true)
    const result = await registerManualPayment(invoiceId, paymentMethod.trim())
    setSubmitting(false)
    if (!result.ok) {
      showError('Não foi possível registrar o pagamento.')
      return
    }
    setShowPaymentSheet(false)
    setPaymentMethod('')
    showSuccess('Pagamento registrado!')
    load(() => false)
  }

  async function handleCancel() {
    if (!invoiceId) return
    setSubmitting(true)
    const result = await cancelInvoice(invoiceId)
    setSubmitting(false)
    if (!result.ok) {
      showError('Não foi possível cancelar a fatura.')
      return
    }
    showSuccess('Fatura cancelada.')
    load(() => false)
  }

  function openRefundSheet() {
    setRefundType('total')
    setRefundAmount('')
    setShowRefundSheet(true)
  }

  async function handleRefund() {
    if (!invoiceId) return
    const amountNumber =
      refundType === 'parcial' ? Number(refundAmount.replace(',', '.')) : undefined
    if (refundType === 'parcial' && (!amountNumber || amountNumber <= 0)) return

    setSubmitting(true)
    const result = await refundInvoice(invoiceId, refundType, amountNumber)
    setSubmitting(false)
    if (!result.ok) {
      showError('Não foi possível estornar a fatura.')
      return
    }
    setShowRefundSheet(false)
    showSuccess(
      refundType === 'parcial'
        ? 'Estorno parcial registrado — fatura continua "Paga".'
        : 'Fatura estornada e cancelada.',
    )
    load(() => false)
  }

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopyLabel('COPIADO!')
        setTimeout(() => setCopyLabel('COPIAR'), 2000)
      },
      () => showError('Não foi possível copiar o link.'),
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ Voltar
        </button>
        <div className="spacer" />
      </div>

      {state.status === 'loading' ? <PageLoading label="Carregando fatura" variant="section" /> : null}
      {state.status === 'error' ? <p role="alert">Não foi possível carregar esta fatura.</p> : null}

      {state.status === 'ready' ? (
        <div className="dash-body">
          <div>
            <h1>Fatura</h1>
            <Badge tone={STATUS_BADGE_TONE[state.invoice.status]}>
              {STATUS_LABEL[state.invoice.status]}
            </Badge>
          </div>

          <div className="card">
            <div className="kv">
              <span className="k">Aluno</span>
              <span className="v">{state.invoice.studentName}</span>
            </div>
            <div className="kv">
              <span className="k">Descrição</span>
              <span className="v">{state.invoice.description}</span>
            </div>
            <div className="kv">
              <span className="k">Valor</span>
              <span className="v">{formatBRL(state.invoice.amount)}</span>
            </div>
            <div className="kv">
              <span className="k">Vencimento</span>
              <span className="v">{formatDate(state.invoice.dueDate)}</span>
            </div>
            <div className="kv">
              <span className="k">Emitida</span>
              <span className="v">{formatDate(state.invoice.createdAt)}</span>
            </div>
            <div className="kv">
              <span className="k">Método</span>
              <span className="v">{state.invoice.paymentMethod ?? '—'}</span>
            </div>
          </div>

          {state.invoice.paymentLink ? (
            <div className="pay-link-box">
              <span>🔗</span>
              <code>{state.invoice.paymentLink}</code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copyLink(state.invoice.paymentLink!)}
              >
                {copyLabel}
              </button>
            </div>
          ) : null}

          <div className="card">
            <h2>Histórico</h2>
            <div className="timeline">
              {state.invoice.events.length === 0 ? (
                <p className="hint">Sem eventos registrados ainda.</p>
              ) : (
                state.invoice.events.map((ev, idx) => (
                  <div className="ev" key={`${ev.eventType}-${idx}`}>
                    <span className="date">{formatDateTime(ev.createdAt)}</span>
                    <span>{EVENT_LABEL[ev.eventType] ?? ev.eventType}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="actions-row">
            {canManage ? (
              <>
                {state.invoice.status !== 'paga' &&
                state.invoice.status !== 'cancelada' &&
                state.invoice.status !== 'estornada' ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-md"
                    onClick={() => setShowPaymentSheet(true)}
                  >
                    Registrar pagamento manual
                  </button>
                ) : null}
                {state.invoice.status === 'gerada' ||
                state.invoice.status === 'enviada' ||
                state.invoice.status === 'atrasada' ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-md"
                    disabled={submitting}
                    onClick={handleCancel}
                  >
                    Cancelar fatura
                  </button>
                ) : null}
                {state.invoice.status === 'paga' ? (
                  <button type="button" className="btn btn-danger btn-md" onClick={openRefundSheet}>
                    Estornar
                  </button>
                ) : null}
              </>
            ) : state.invoice.paymentLink &&
              state.invoice.status !== 'paga' &&
              state.invoice.status !== 'cancelada' &&
              state.invoice.status !== 'estornada' ? (
              <a
                className="btn btn-primary btn-md btn-full"
                href={state.invoice.paymentLink}
                target="_blank"
                rel="noreferrer"
              >
                PAGAR AGORA
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        label="Registrar pagamento manual"
      >
        <div className="ptab-panel">
          <h2 className="sec-head-title">Registrar pagamento manual</h2>
          <Input
            id="payment-method"
            label="Método de pagamento"
            type="text"
            placeholder="Ex.: dinheiro, pix, cartão"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-full"
            disabled={paymentMethod.trim() === '' || submitting}
            onClick={handleManualPayment}
          >
            Confirmar pagamento
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={showRefundSheet}
        onClose={() => setShowRefundSheet(false)}
        label="Estornar fatura"
      >
        {state.status === 'ready' ? (
          <div className="stack">
            <h2 className="sec-head-title">Estornar fatura</h2>
            <p className="ssub">
              {state.invoice.description} · {state.invoice.studentName} · paga em{' '}
              {state.invoice.paidAt ? formatDate(state.invoice.paidAt) : '—'} ·{' '}
              {formatBRL(state.invoice.amount)}
            </p>

            <div className="field">
              <label>Tipo de estorno</label>
              <div className="tabs2">
                <button
                  type="button"
                  className={refundType === 'total' ? 'active' : ''}
                  onClick={() => setRefundType('total')}
                >
                  Total — {formatBRL(state.invoice.amount)}
                </button>
                <button
                  type="button"
                  className={refundType === 'parcial' ? 'active' : ''}
                  onClick={() => setRefundType('parcial')}
                >
                  Parcial
                </button>
              </div>
            </div>

            {refundType === 'parcial' ? (
              <Input
                id="refund-amount"
                label="Valor a estornar"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            ) : null}

            <div className="refund-rule-toast" role="status">
              {refundType === 'parcial'
                ? 'Estorno parcial mantém o status "Paga", com o registro do estorno anexado ao histórico da fatura.'
                : 'Estorno total cancela a fatura por completo.'}
            </div>

            <button
              type="button"
              className="btn btn-danger btn-md btn-full"
              disabled={
                submitting ||
                (refundType === 'parcial' && !(Number(refundAmount.replace(',', '.')) > 0))
              }
              onClick={handleRefund}
            >
              Confirmar estorno
            </button>
          </div>
        ) : null}
      </BottomSheet>

      <Toast message={message} variant={variant} onDismiss={dismiss} />
      <Link className="hint" to="/perfil">
        Voltar ao início
      </Link>
    </AppShell>
  )
}
