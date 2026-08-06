import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Icon } from '../../components/ui/Icon/Icon'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { ensureMe } from '../../lib/query/identity'
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
 * duplicar 6 entradas evita um cast forçado só pra reaproveitar a tabela.
 *
 * Os sinais gráficos (✓/●) são os do frame mobile (node 165:1849, "✓ Paga") —
 * mesmos marcadores já usados por F5MyInvoicesPage.tsx nos cards de fatura. */
const INVOICE_STATUS_LABEL: Record<string, string> = {
  gerada: '● Pendente',
  enviada: '● Pendente',
  paga: '✓ Paga',
  atrasada: '● Atrasada',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
}

/** Tom de cor do rótulo de status na linha do histórico. O frame não usa
 * badge aqui (só texto colorido, node 165:1849), então o tom vira uma classe
 * de cor e não um `ui/Badge`. */
function invoiceStatusTone(status: string): 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'paga':
      return 'success'
    case 'enviada':
    case 'gerada':
      return 'warning'
    case 'atrasada':
      return 'danger'
    default:
      return 'muted'
  }
}

/** Os 3 únicos valores de `public.subscriptions.status`
 * (migrations/000048_subscriptions.up.sql, CHECK constraint) — não uma
 * suposição. Antes desta tela ter a linha "Status" do Figma (node 165:1831),
 * o badge era o literal "Ativa" independente do que o backend devolvesse.
 *
 * `cancelled` continua sendo mostrado como uma assinatura que existe: o
 * comentário da própria coluna diz que o cancelamento não é imediato — a
 * assinatura vale até `end_date`, que a linha "Período" logo acima já
 * mostra. */
const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: BadgeProps['tone'] }> = {
  active: { label: '✓ Ativa', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'warning' },
  expired: { label: 'Expirada', tone: 'neutral' },
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
 *
 * # Reskin design system (Figma "14 · Minha Assinatura", node 165:1781
 * mobile / 186:2227 desktop)
 *
 * Componentes do DS: `Card` (card do plano), `Badge` (linha Status),
 * `Button` (Trocar plano / Cancelar assinatura / Entendi), `AlertCard`
 * (erro de carregamento), `EmptyState` (sem assinatura) e `PageLoading`.
 *
 * LAYOUT ÚNICO, sem tabela — mesmo caso de F3InvoiceDetailPage.tsx e ao
 * contrário de F5MyInvoicesPage.tsx: os DOIS frames mostram a mesma coluna
 * (640px no desktop) com um card de linhas rótulo/valor e uma lista de
 * pagamentos. Nada de `dash-body--wide` nem de `ui/TableRow` aqui. As duas
 * diferenças entre os frames são 100% CSS em BREAKPOINT_SHELL_DESKTOP_MIN
 * (860px, o ponto em que a sidebar do shell aparece): o "‹ Voltar" mobile
 * some (o desktop não desenha nenhuma navegação de volta — a sidebar é a
 * navegação) e a lista de pagamentos vira um card único com linhas
 * divididas em vez de três cards soltos.
 *
 * MAPEAMENTO (o frame desenha uma assinatura ativa de um aluno fictício):
 * - "Recorrência" e "Valor" são DUAS linhas no frame; antes eram uma só
 *   ("Trimestral · R$ 315,00/mês").
 * - "Status" saiu do cabeçalho do card (onde era um badge ao lado do nome do
 *   plano) e virou uma linha rótulo/valor como as outras, com o badge à
 *   direita — como no frame. O rótulo agora vem de
 *   `public.subscriptions.status` de verdade (ver SUBSCRIPTION_STATUS).
 * - as linhas do histórico mostram `description · valor` (o frame escreve
 *   "Mar/26 · R$ 315"; `description` é o dado equivalente que a API devolve,
 *   e já é "Mensalidade Mar/2026" no seed real).
 * - o rodapé explicativo ("Cancelar vale até o fim do período pago…") não
 *   está no frame mas é regra de negócio da doc — preservado, só
 *   retokenizado.
 */
export default function PL4MySubscriptionPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showCancelInfo, setShowCancelInfo] = useState(false)
  const queryClient = useQueryClient()

  const load = useCallback((onCancelled: () => boolean) => {
    // `ensureMe` no lugar de `getMe()`: mesmo contrato de retorno, mas
    // reaproveitando o GET /me que o `useShellIdentity` acima já buscou.
    ensureMe(queryClient)
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
  }, [queryClient])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  return (
    <>
      {/* "‹ Voltar" existe só no frame mobile (node 165:1815); no desktop
          (186:2227) o topo é só o título — quem navega é a sidebar. Os dois
          estados vivem no mesmo DOM e quem escolhe é a @media de
          `.pl4-nav-back`, sem `matchMedia` (mesmo mecanismo de F3). */}
      <div className="pg-head pl4-head">
        <button
          type="button"
          className="pl4-nav-back"
          onClick={() => unitId && navigate(`/units/${unitId}/dashboard`)}
        >
          ‹ Voltar
        </button>
        <h1 className="pl4-title">Minha assinatura</h1>
      </div>

      <div className="dash-body pl4-body">
        {state.status === 'loading' ? (
          <PageLoading label="Carregando assinatura" variant="section" />
        ) : null}
        {state.status === 'error' ? (
          <div className="pl4-alert" role="alert">
            <AlertCard tone="danger" showIcon>
              Não foi possível carregar sua assinatura.
            </AlertCard>
          </div>
        ) : null}
        {state.status === 'empty' ? (
          <EmptyState
            icon={<Icon name="receipt" size={40} />}
            title="Nenhum plano ativo"
            description="Fale com a recepção para contratar."
          />
        ) : null}

        {state.status === 'ready' ? (
          <>
            <SubscriptionCard subscription={state.subscription} />

            <div className="pl4-actions">
              <div className="pl4-actions__change">
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => unitId && navigate(`/units/${unitId}/my-subscription/change-plan`)}
                >
                  Trocar plano
                </Button>
              </div>
              {/* Ghost (e não `variant="danger"`, que é preenchido): o frame
                  mostra um link de texto vermelho, não um botão sólido — a cor
                  vem de `.pl4-actions__cancel` no CSS. */}
              <div className="pl4-actions__cancel">
                <Button variant="ghost" size="md" fullWidth onClick={() => setShowCancelInfo(true)}>
                  Cancelar assinatura
                </Button>
              </div>
            </div>

            <h2 className="pl4-section-title">Histórico de pagamentos</h2>
            {state.subscription.invoices.length === 0 ? (
              <p className="pl4-hint">Nenhuma fatura ainda.</p>
            ) : (
              <div className="pl4-history">
                {state.subscription.invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  />
                ))}
              </div>
            )}

            <p className="pl4-foot-note">
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
          <h2 className="pl4-sheet-title">Cancelar assinatura</h2>
          <p className="pl4-hint">
            Ainda não existe um endpoint de cancelamento de assinatura no backend — esta ação não
            está disponível nesta versão. Quando cancelar, o cancelamento vale até o fim do período
            já pago (nunca é imediato). Fale com a recepção se precisar cancelar agora.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowCancelInfo(false)}>
            Entendi
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}

function SubscriptionCard({ subscription }: { subscription: SubscriptionDetail }) {
  const pct = periodProgressPercent(
    subscription.startDate,
    subscription.endDate,
    subscription.remainingDays,
  )
  const expiring = isExpiringSoon(subscription.remainingDays)
  const status = SUBSCRIPTION_STATUS[subscription.status] ?? {
    label: subscription.status,
    tone: 'neutral' as const,
  }
  /* Único valor que só existe em runtime (a % vem dos dados). Vai como
     CUSTOM PROPERTY e não como `width` literal — mesma convenção do
     `ui/Card` (`--card-padding`) e do gate de estilo inline do DS
     (src/components/ui/legacyGate.test.ts): quem desenha continua sendo o
     CSS, o TSX só entrega o número. */
  const fillStyle = { '--pl4-progress': `${pct}%` } as CSSProperties

  return (
    <Card>
      <div className="pl4-plan">
        <h2 className="pl4-plan__name">{subscription.plan.name}</h2>

        <dl className="pl4-rows">
          <div className="pl4-row">
            <dt className="pl4-row__label">Recorrência</dt>
            <dd className="pl4-row__value">
              {CYCLE_LABELS[subscription.planVariant.billingCycle]}
            </dd>
          </div>
          <div className="pl4-row">
            <dt className="pl4-row__label">Valor</dt>
            <dd className="pl4-row__value">
              {formatBRL(subscription.planVariant.finalPrice)}/mês
            </dd>
          </div>
          <div className="pl4-row">
            <dt className="pl4-row__label">Período</dt>
            <dd className="pl4-row__value">
              {formatDateBR(subscription.startDate)} – {formatDateBR(subscription.endDate)}
            </dd>
          </div>
          <div className="pl4-row">
            <dt className="pl4-row__label">Renova em</dt>
            <dd
              className={`pl4-row__value${expiring ? ' pl4-row__value--warning' : ''}`}
            >
              {subscription.remainingDays} {subscription.remainingDays === 1 ? 'dia' : 'dias'}
            </dd>
          </div>
          <div className="pl4-row">
            <dt className="pl4-row__label">Status</dt>
            <dd className="pl4-row__value">
              <Badge tone={status.tone}>{status.label}</Badge>
            </dd>
          </div>
          <div className="pl4-row">
            <dt className="pl4-row__label">Renovação automática</dt>
            <dd className="pl4-row__value">{subscription.autoRenew ? 'Sim' : 'Não'}</dd>
          </div>
        </dl>

        <div className="pl4-progress">
          <div className="pl4-progress__track">
            <div className="pl4-progress__fill" style={fillStyle} />
          </div>
          <span className="pl4-progress__label">{pct}% do período</span>
        </div>
      </div>
    </Card>
  )
}

function InvoiceRow({ invoice, onClick }: { invoice: SubscriptionInvoice; onClick: () => void }) {
  const tone = invoiceStatusTone(invoice.status)

  return (
    <button type="button" className="pl4-history__row" onClick={onClick}>
      <span className="pl4-history__label">
        {invoice.description} · {formatBRL(invoice.amount)}
      </span>
      <span className={`pl4-history__status pl4-history__status--${tone}`}>
        {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
      </span>
    </button>
  )
}
