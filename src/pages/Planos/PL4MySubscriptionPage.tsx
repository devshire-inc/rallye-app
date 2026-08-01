import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { getMe } from '../../lib/api/me'
import type { BillingCycle } from '../../lib/api/plans'
import {
  getSubscription,
  type SubscriptionDetail,
  type SubscriptionInvoice,
} from '../../lib/api/subscriptions'
import { formatBRL } from '../../lib/money'
import { formatDateBR, isExpiringSoon, periodProgressPercent } from '../../lib/subscriptionPeriod'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './PL4MySubscriptionPage.css'

/** Mesmo vocabulário PT-BR de `billing_cycle` já duplicado em
 * PlanoFormPage.tsx (CYCLE_DEFAULTS) e VincularPlanoSheet.tsx
 * (CYCLE_LABELS) — duplicação mínima intencional, mesmo padrão já aceito
 * neste pacote (ver comentário de pacote em ambos os arquivos). */
const CYCLE_LABELS: Record<BillingCycle, string> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

/** Vocabulário de status de fatura (public.invoices.status) — mesmos rótulos
 * de src/lib/invoiceStatus.ts (STATUS_LABEL/statusBadgeClass), mas
 * duplicado aqui em vez de importado: aquele módulo tipa `status` como
 * `InvoiceStatus` (de ../api/invoices), enquanto `SubscriptionInvoice.status`
 * (../lib/api/subscriptions) é `string` — mesmo domínio de valores (mesma
 * coluna, mesma tabela), mas tipos diferentes na borda de cada cliente HTTP;
 * duplicar 6 entradas evita um cast forçado só pra reaproveitar a tabela. */
const INVOICE_STATUS_LABEL: Record<string, string> = {
  gerada: 'Gerada',
  enviada: 'Pendente',
  paga: 'Paga',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
}

function invoiceBadgeTone(status: string): BadgeProps['tone'] {
  switch (status) {
    case 'paga':
      return 'success'
    case 'enviada':
      return 'warning'
    case 'atrasada':
      return 'danger'
    case 'estornada':
      return 'info'
    case 'gerada':
    case 'cancelada':
    default:
      return 'neutral'
  }
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  /** GET /students/{id}/subscription devolveu 404 (`subscription_not_found`)
   * — não é uma falha, é o estado documentado "Sem assinatura" da doc real
   * (PL4, `scr-pl4`, tabela de Estados). */
  | { status: 'empty' }
  | { status: 'ready'; subscription: SubscriptionDetail }

/**
 * PL4 — Minha Assinatura (Aluno) (BEAC-1937, story BEAC-1927 — "Planos e
 * Assinaturas"). Layout/copy lidos diretamente da doc real do protótipo
 * (Allye docs, ID 981380ff-8beb-4792-ad47-2c85b08e1d23, `scr-pl4`): card com
 * nome do plano, badge "Ativa", recorrência+preço, período vigente,
 * "Renova em: N dias", barra de progresso do período, botões [TROCAR PLANO]/
 * [CANCELAR ASSINATURA], seção "Histórico de Pagamentos".
 *
 * # Identidade — GET /me, mesmo padrão de AG3StudentAgendaPage.tsx
 *
 * Esta tela é "Aluno vê a própria assinatura" (Roles: Aluno) — não recebe
 * nenhum studentId por rota/props. Usa GET /me (../../lib/api/me.ts) pra
 * descobrir o próprio profile id antes de chamar GET
 * /students/{id}/subscription (BEAC-1972), exatamente como
 * AG3StudentAgendaPage.tsx já faz pra escopar a própria agenda.
 *
 * # Rota — decisão própria, não travada na task
 *
 * A doc não define uma rota; BEAC-1937 só pede "renderizar/plugar o botão"
 * pra PL5. Escolhida `/units/:unitId/my-subscription` (e
 * `/units/:unitId/my-subscription/change-plan` pro botão [TROCAR PLANO],
 * ver abaixo) espelhando o padrão "my-X" já usado por F5MyInvoicesPage.tsx
 * (`/units/:unitId/my-invoices`) — a tela irmã mais próxima em natureza
 * (financeiro, self-service, "aluno vê só o que é dele"), em vez do padrão
 * `/plans/*` de PL1/PL2 (que são telas de Admin, catálogo, não
 * self-service).
 *
 * # [CANCELAR ASSINATURA] — sem endpoint, estado explicitamente indisponível
 *
 * Não existe, em nenhum lugar deste código (frontend ou backend), um
 * endpoint de cancelamento de assinatura (comentário de pacote em
 * rallye-api/api/internal/subscriptions/handler.go confirma: "não existe
 * CancelHandler"). O botão aparece (AC/doc pedem) mas seu clique abre um
 * BottomSheet explicando que a ação ainda não está disponível — não finge
 * cancelar, não chama nenhum endpoint inexistente.
 *
 * # [TROCAR PLANO] — navega pra PL5 (BEAC-1938)
 *
 * O botão navega pra `/units/:unitId/my-subscription/change-plan`, rota
 * registrada em App.tsx apontando para PL5ChangePlanPage.tsx (BEAC-1938,
 * mesma story) — a tela de upgrade/downgrade com cálculo de pro-rata.
 *
 * # Barra de progresso — sem depender do relógio do navegador
 *
 * `remainingDays` já vem calculado pelo backend (GetHandler, "hoje" do
 * servidor). ../../lib/subscriptionPeriod.ts deriva a % do período decorrido
 * só a partir de `startDate`/`endDate`/`remainingDays` — sem `new Date()` no
 * cliente, evitando qualquer divergência de fuso/hora.
 *
 * # "Pagamentos" — sem segunda query
 *
 * `invoices` vem embutido na própria resposta de GetHandler (AC de
 * BEAC-1937: "use o array `invoices` diretamente") — esta tela não chama
 * GET /units/{id}/invoices nem nenhum outro endpoint de fatura.
 */
export default function PL4MySubscriptionPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showCancelInfo, setShowCancelInfo] = useState(false)

  const load = useCallback((onCancelled: () => boolean) => {
    getMe()
      .then((meResult) => {
        if (onCancelled()) return
        if (!meResult.ok) {
          setState({ status: 'error' })
          return
        }
        return getSubscription(meResult.id).then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            if (result.status === 404) {
              setState({ status: 'empty' })
              return
            }
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', subscription: result.subscription })
        })
      })
      .catch(() => {
        if (onCancelled()) return
        setState({ status: 'error' })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <IconButton
          variant="ghost"
          size="sm"
          label="Voltar"
          onClick={() => unitId && navigate(`/units/${unitId}/dashboard`)}
        >
          ←
        </IconButton>
        <h1>Minha Assinatura</h1>
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <PageLoading label="Carregando assinatura" variant="section" /> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar sua assinatura.</p>
        ) : null}
        {state.status === 'empty' ? (
          <p className="empty-state">Nenhum plano ativo. Fale com a recepção para contratar.</p>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <SubscriptionCard subscription={state.subscription} />

            <div className="actions-row">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => unitId && navigate(`/units/${unitId}/my-subscription/change-plan`)}
              >
                Trocar plano
              </Button>
              <Button variant="danger" fullWidth onClick={() => setShowCancelInfo(true)}>
                Cancelar assinatura
              </Button>
            </div>

            <h2 className="sec-head-title">Pagamentos</h2>
            {state.subscription.invoices.length === 0 ? (
              <p className="hint">Nenhuma fatura ainda.</p>
            ) : (
              <div className="ag-list">
                {state.subscription.invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  />
                ))}
              </div>
            )}

            <p className="foot-note">
              Cancelar vale até o fim do período pago (não é imediato). Aluno não contrata sozinho —
              o admin vincula (PL3); mas pode trocar/cancelar.
            </p>
          </>
        ) : null}
      </div>

      <BottomSheet
        open={showCancelInfo}
        onClose={() => setShowCancelInfo(false)}
        label="Cancelar assinatura"
      >
        <div className="stack">
          <h2 className="sec-head-title">Cancelar assinatura</h2>
          <p className="hint">
            Ainda não existe um endpoint de cancelamento de assinatura no backend — esta ação não
            está disponível nesta versão. Quando cancelar, o cancelamento vale até o fim do período
            já pago (nunca é imediato). Fale com a recepção se precisar cancelar agora.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowCancelInfo(false)}>
            Entendi
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  )
}

function SubscriptionCard({ subscription }: { subscription: SubscriptionDetail }) {
  const pct = periodProgressPercent(
    subscription.startDate,
    subscription.endDate,
    subscription.remainingDays,
  )
  const expiring = isExpiringSoon(subscription.remainingDays)

  return (
    <Card padding="var(--space-4)">
      <div className="sub-card">
        <div className="sub-card-head">
          <h3>{subscription.plan.name}</h3>
          <Badge tone="success">Ativa</Badge>
        </div>

        <div className="kv">
          <span className="k">Recorrência</span>
          <span className="v">
            {CYCLE_LABELS[subscription.planVariant.billingCycle]} ·{' '}
            {formatBRL(subscription.planVariant.finalPrice)}/mês
          </span>
        </div>
        <div className="kv">
          <span className="k">Período</span>
          <span className="v">
            {formatDateBR(subscription.startDate)} - {formatDateBR(subscription.endDate)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Renova em</span>
          <span className="v" style={expiring ? { color: 'var(--state-warning)' } : undefined}>
            {subscription.remainingDays} {subscription.remainingDays === 1 ? 'dia' : 'dias'}
          </span>
        </div>
        <div className="kv">
          <span className="k">Renovação automática</span>
          <span className="v">{subscription.autoRenew ? 'Sim' : 'Não'}</span>
        </div>

        <div className="period-progress">
          <div className="period-progress-track">
            <div className="period-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="period-progress-label">{pct}% do período</span>
        </div>
      </div>
    </Card>
  )
}

function InvoiceRow({ invoice, onClick }: { invoice: SubscriptionInvoice; onClick: () => void }) {
  return (
    <button type="button" className="inv-row" onClick={onClick}>
      <span className="iw">
        <span className="nm">{invoice.description}</span>
        <span className="desc">
          {formatBRL(invoice.amount)} · vencimento {formatDateBR(invoice.dueDate)}
        </span>
      </span>
      <span className="tail">
        <Badge tone={invoiceBadgeTone(invoice.status)}>
          {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
        </Badge>
      </span>
    </button>
  )
}
