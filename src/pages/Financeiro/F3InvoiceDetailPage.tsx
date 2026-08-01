import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { Icon } from '../../components/ui/Icon/Icon'
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
 *
 * Reskin design system (Figma "12 · Detalhe da Fatura", node 159:1744 mobile
 * / 186:2189 desktop): `Card` (bloco de dados + histórico), `Badge` (status),
 * `Button` (todas as ações), `AlertCard` (erro de carregamento) e
 * `PageLoading`. LAYOUT ÚNICO, sem tabela: ao contrário de F5 (Minhas
 * Faturas), os DOIS frames desta tela mostram a mesma coluna de ~640px com
 * um card de linhas rótulo/valor — o desktop só troca o "‹ Voltar" mobile
 * pelo breadcrumb "Minhas faturas › Detalhe" e alarga a coluna. Então nada de
 * `dash-body--wide` nem de `ui/TableRow` aqui: o padrão "cards no mobile,
 * `<table>` no desktop" não se aplica a esta tela.
 *
 * A troca voltar/breadcrumb é 100% CSS em BREAKPOINT_SHELL_DESKTOP_MIN
 * (860px, o ponto em que a sidebar aparece — mesmo mecanismo e mesmo
 * breakpoint de TrocarArenaPage, que resolve exatamente este par), com os
 * dois no DOM e sem `matchMedia`.
 *
 * MAPEAMENTO (o Figma desenha o caso Aluno de uma fatura pendente; esta tela
 * também serve Admin e todos os status):
 * - h1 = `description` ("Mensalidade Mar/2026" no frame), não mais o literal
 *   "Fatura"; a linha "Descrição" saiu do card por já ser o título.
 * - linhas do card: Aluno / Vencimento / Emitida / Método — o frame mostra
 *   "Plano", que aqui não existe como campo próprio (o plano ESTÁ na
 *   descrição, que virou o título), então a primeira linha é "Aluno", o dado
 *   equivalente que a API devolve. "Método sugerido" (rótulo do frame, fatura
 *   pendente) vira "Método" quando a fatura já foi paga — aí o campo é o
 *   método efetivamente usado, não uma sugestão.
 * - "Total" destacado após um divisor, exatamente como no frame.
 * - o botão do frame ("Pagar agora com PIX") é o [PAGAR AGORA] que já
 *   existia. ATUALIZADO na tela 13 (Pagamento PIX): em vez de abrir o
 *   `payment_link` numa aba, ele navega para /invoices/{id}/pix, onde a
 *   cobrança é emitida (POST /invoices/{id}/payments/pix) e acompanhada. NÃO
 *   há gateway de pagamento integrado (a cobrança do backend é `mock` e o
 *   código é impagável de propósito) — ver PixPaymentPage.tsx.
 * - o `payment_link` continua exibido na caixa "copiar link" abaixo, para as
 *   duas visões: é um dado real que o admin pode ter cadastrado apontando
 *   para outro meio (boleto, checkout externo). O que ele deixou de ser é o
 *   CTA principal do aluno.
 * - o texto de rodapé do frame ("Pagamentos são processados de forma
 *   segura…") é reproduzido sob o CTA, só na visão Aluno.
 *
 * Blocos que o Figma NÃO desenha e continuam aqui (lógica de negócio
 * preservada, apenas retokenizada): link de pagamento + [COPIAR], histórico
 * de eventos e as ações de Admin (registrar pagamento manual, cancelar,
 * estornar).
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

  /* CTA [PAGAR AGORA] da visão Aluno (node 163:5473/186:4961): as mesmas três
   * exclusões de status de sempre — pagar só faz sentido enquanto a fatura
   * está em aberto.
   *
   * MUDOU (tela 13 · Pagamento PIX): não depende mais de `payment_link`. Antes
   * o CTA só aparecia se o admin tivesse cadastrado um link, porque abrir esse
   * link era tudo o que ele sabia fazer. Agora ele emite uma cobrança PIX de
   * verdade (POST /invoices/{id}/payments/pix), que existe para qualquer
   * fatura pagável — então o gate virou só o status. */
  const isPayable =
    state.status === 'ready' &&
    state.invoice.status !== 'paga' &&
    state.invoice.status !== 'cancelada' &&
    state.invoice.status !== 'estornada'

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      {/* Voltar (mobile, node 163:5454) e breadcrumb (desktop, node 186:4939)
          convivem no DOM; quem escolhe é a @media de `.f3-nav-*` em
          Financeiro.css, no mesmo breakpoint da sidebar do shell. */}
      <div className="pg-head f3-head">
        <button type="button" className="back f3-nav-back" onClick={() => navigate(-1)}>
          ‹ Voltar
        </button>
        <nav className="f3-nav-crumbs" aria-label="Trilha de navegação">
          <button type="button" className="f3-nav-crumbs__link" onClick={() => navigate(-1)}>
            {/* O frame é da visão Aluno ("Minhas faturas"); na visão Admin a
                origem é F2 (a lista da arena), então o rótulo acompanha. Os
                dois voltam pela mesma navegação relativa: F3 é alcançável
                tanto por F2 quanto por F5 e nenhuma das duas tem rota fixa
                daqui (F5 depende do `unitId` que esta rota não recebe). */}
            {canManage ? 'Faturas' : 'Minhas faturas'}
          </button>
          <Icon name="chevron-right" size={12} />
          <span className="f3-nav-crumbs__current">Detalhe</span>
        </nav>
        <div className="spacer" />
      </div>

      {state.status === 'loading' ? <PageLoading label="Carregando fatura" variant="section" /> : null}
      {state.status === 'error' ? (
        <div className="dash-body f3-error" role="alert">
          <AlertCard tone="danger" showIcon>
            Não foi possível carregar esta fatura.
          </AlertCard>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div className="dash-body f3-detail">
          <header className="f3-header">
            <h1 className="f3-header__title">{state.invoice.description}</h1>
            <Badge tone={STATUS_BADGE_TONE[state.invoice.status]}>
              {STATUS_LABEL[state.invoice.status]}
            </Badge>
          </header>

          <Card>
            <dl className="f3-rows">
              <div className="f3-row">
                <dt className="f3-row__label">Aluno</dt>
                <dd className="f3-row__value">{state.invoice.studentName}</dd>
              </div>
              <div className="f3-row">
                <dt className="f3-row__label">Vencimento</dt>
                <dd className="f3-row__value">{formatDate(state.invoice.dueDate)}</dd>
              </div>
              <div className="f3-row">
                <dt className="f3-row__label">Emitida</dt>
                <dd className="f3-row__value">{formatDate(state.invoice.createdAt)}</dd>
              </div>
              <div className="f3-row">
                {/* "sugerido" só enquanto a fatura não foi paga — depois o
                    campo é o método realmente usado (ver JSDoc). */}
                <dt className="f3-row__label">
                  {state.invoice.status === 'paga' ? 'Método' : 'Método sugerido'}
                </dt>
                <dd className="f3-row__value">{state.invoice.paymentMethod ?? '—'}</dd>
              </div>
              <div className="f3-rows__divider" role="presentation" />
              <div className="f3-row f3-row--total">
                <dt className="f3-row__label">Total</dt>
                <dd className="f3-row__value">{formatBRL(state.invoice.amount)}</dd>
              </div>
            </dl>
          </Card>

          {canManage ? (
            <div className="actions-row">
              {state.invoice.status !== 'paga' &&
              state.invoice.status !== 'cancelada' &&
              state.invoice.status !== 'estornada' ? (
                <Button variant="primary" size="md" onClick={() => setShowPaymentSheet(true)}>
                  Registrar pagamento manual
                </Button>
              ) : null}
              {state.invoice.status === 'gerada' ||
              state.invoice.status === 'enviada' ||
              state.invoice.status === 'atrasada' ? (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={submitting}
                  onClick={handleCancel}
                >
                  Cancelar fatura
                </Button>
              ) : null}
              {state.invoice.status === 'paga' ? (
                <Button variant="danger" size="md" onClick={openRefundSheet}>
                  Estornar
                </Button>
              ) : null}
            </div>
          ) : isPayable ? (
            <>
              {/* `ui/Button` (e não mais uma âncora externa): o destino agora é
                  uma rota interna, /invoices/{id}/pix, onde a cobrança é
                  emitida e acompanhada. A âncora anterior existia porque o
                  destino era a URL do provedor no `payment_link` — esse link
                  não sumiu, continua na caixa "copiar link" abaixo, só deixou
                  de ser o CTA principal do aluno. Continua não havendo gateway
                  de pagamento integrado; ver PixPaymentPage.tsx. */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate(`/invoices/${state.invoice.id}/pix`)}
              >
                Pagar agora com PIX
              </Button>
              <p className="f3-cta-note">
                Pagamentos são processados de forma segura. Após o pagamento, sua fatura é
                atualizada automaticamente.
              </p>
            </>
          ) : null}

          {state.invoice.paymentLink ? (
            <div className="pay-link-box">
              <Icon name="link" size={16} />
              <code>{state.invoice.paymentLink}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyLink(state.invoice.paymentLink!)}
              >
                {copyLabel}
              </Button>
            </div>
          ) : null}

          <Card>
            <h2 className="f3-section-title">Histórico</h2>
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
          </Card>
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
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={paymentMethod.trim() === '' || submitting}
            onClick={handleManualPayment}
          >
            Confirmar pagamento
          </Button>
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

            <Button
              variant="danger"
              size="md"
              fullWidth
              disabled={
                submitting ||
                (refundType === 'parcial' && !(Number(refundAmount.replace(',', '.')) > 0))
              }
              onClick={handleRefund}
            >
              Confirmar estorno
            </Button>
          </div>
        ) : null}
      </BottomSheet>

      <Toast message={message} variant={variant} onDismiss={dismiss} />
    </AppShell>
  )
}
