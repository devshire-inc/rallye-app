import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { getMe } from '../../lib/api/me'
import { getPlan, listPlans, type BillingCycle } from '../../lib/api/plans'
import { changePlan, getSubscription, type SubscriptionDetail } from '../../lib/api/subscriptions'
import { formatBRL } from '../../lib/money'
import { totalPeriodDays } from '../../lib/subscriptionPeriod'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './PL5ChangePlanPage.css'

/** Mesmo vocabulário PT-BR de `billing_cycle` já duplicado em
 * PL4MySubscriptionPage.tsx/PlanoFormPage.tsx/VincularPlanoSheet.tsx —
 * duplicação mínima intencional, mesmo padrão já aceito neste pacote. */
const CYCLE_LABELS: Record<BillingCycle, string> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

/** Arredonda pra 2 casas decimais — mesma regra de round2() no backend real
 * (rallye-api/api/internal/subscriptions/handler.go, prorate()). Usado só
 * pra prévia otimista client-side (ver comentário de arquivo abaixo); o
 * valor que de fato é cobrado/creditado vem sempre da resposta de
 * `changePlan`, nunca deste cálculo. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

interface PlanOption {
  planId: string
  planName: string
  variantId: string
  finalPrice: number
  isCurrent: boolean
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; subscription: SubscriptionDetail; options: PlanOption[] }

/**
 * PL5 — Upgrade/Downgrade de Plano (BEAC-1938, story BEAC-1927 — "Planos e
 * Assinaturas"). Layout/copy/regras lidos diretamente da doc real do
 * protótipo (Allye docs, ID 4143a0b5-8500-492a-b031-3dd4b2e1bf75, `scr-pl5`):
 * bloco "Plano atual", lista de planos selecionáveis (badge Upgrade/
 * Downgrade, opção atual travada), bloco de cálculo pro-rata dinâmico,
 * botão "CONFIRMAR TROCA".
 *
 * # Origem: botão [TROCAR PLANO] de PL4 (BEAC-1937)
 *
 * Rota `/units/:unitId/my-subscription/change-plan`, já referenciada (mas
 * deliberadamente não registrada) por PL4MySubscriptionPage.tsx — este task
 * registra a rota em App.tsx e constrói a tela que faltava.
 *
 * # Cálculo client-side é só uma PRÉVIA — o real vem da API
 *
 * O bloco de cálculo é recalculado a cada seleção usando a MESMA fórmula do
 * backend (prorate() em subscriptions/handler.go: (dias restantes / dias
 * totais do período) × diferença de preço) só para feedback visual imediato
 * enquanto o aluno navega as opções — nenhum valor exibido aqui é
 * persistido diretamente. Ao confirmar, `POST /subscriptions/{id}/
 * change-plan` (BEAC-1933) é chamado e sua resposta (`prorated_amount`/
 * `invoice`) é a única fonte de verdade pro que de fato foi cobrado/
 * creditado.
 *
 * # Lista de planos: restrita à mesma recorrência, entre TODOS os planos
 *
 * "3x/semana" e "Ilimitado" (doc, exemplo do mockup) são planos DIFERENTES
 * do atual "2x/semana" — não variantes de um mesmo plano (sessions_per_week
 * é atributo de VARIANTE no schema real, migrations/000047, mas cada plano
 * de frequência diferente tem seu próprio conjunto de variantes de
 * recorrência). GET /units/{id}/plans (BEAC-1931) só devolve um resumo sem
 * as variantes (PlanSummary, sem array `variants` — conferido lendo
 * plans/handler.go antes de assumir); pra montar a lista filtrada por
 * recorrência é necessário buscar o detalhe de CADA plano ativo via
 * `getPlan` (GET /plans/{id}, BEAC-1976) e filtrar as variantes com
 * `billingCycle` igual à do plano atual. N+1 chamadas (1 listPlans + 1
 * getPlan por plano ativo do catálogo) — aceitável dado que BEAC-1931 (já
 * Done, contrato travado) não expõe nenhum endpoint de catálogo "todas as
 * variantes de todos os planos" mais barato; não é um novo endpoint desta
 * task inventar.
 *
 * # Antes de BEAC-1976: 403 pra qualquer aluno real
 *
 * Esta tela reaproveitava `getPlanForEdit` (PATCH /plans/{id} com corpo
 * vazio) pra buscar o detalhe de cada plano — endpoint que exigia
 * financeiro:write, permission que um Aluno NUNCA tem (matriz de seed,
 * migrations/000016). Resultado: PL5 nunca funcionava de fato pra um
 * estudante, só pra quem já tinha permissão de escrita em financeiro
 * (achado no review de BEAC-1938). BEAC-1976 criou GET /plans/{id}
 * acessível a qualquer membro da unit — esta tela agora chama `getPlan`
 * diretamente (não mais `getPlanForEdit`, nome que sinaliza um fluxo
 * administrativo e não deveria vazar pra uma tela de aluno).
 *
 * # Opção "atual" é sintetizada a partir da própria assinatura, não do catálogo
 *
 * A primeira opção da lista (nome/preço/recorrência "(atual)", travada) vem
 * direto de `subscription.plan`/`subscription.planVariant` — não depende de
 * o plano/variante atual ainda estar `isActive` no catálogo (um plano pode
 * ser desativado depois que alunos já estão inscritos nele, AC de PL2:
 * "editar/desativar não afeta assinaturas existentes").
 */
export default function PL5ChangePlanPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  /** `null` = nenhuma confirmação de downgrade pendente; caso contrário, o
   * crédito aplicado (R$) a mostrar no BottomSheet de confirmação. */
  const [downgradeCredit, setDowngradeCredit] = useState<number | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId) return
      getMe()
        .then((meResult) => {
          if (onCancelled()) return
          if (!meResult.ok) {
            setState({ status: 'error' })
            return
          }
          return getSubscription(meResult.id).then((subResult) => {
            if (onCancelled()) return
            if (!subResult.ok) {
              setState({ status: 'error' })
              return
            }
            const subscription = subResult.subscription

            return listPlans(unitId).then((plansResult) => {
              if (onCancelled()) return
              if (!plansResult.ok) {
                setState({ status: 'error' })
                return
              }

              const activePlans = plansResult.groups
                .flatMap((group) => group.plans)
                .filter((plan) => plan.isActive)

              return Promise.all(activePlans.map((plan) => getPlan(plan.id))).then((details) => {
                if (onCancelled()) return

                const catalogOptions: PlanOption[] = []
                for (const detail of details) {
                  if (!detail.ok || !detail.plan.isActive) continue
                  for (const variant of detail.plan.variants) {
                    if (!variant.isActive) continue
                    if (variant.billingCycle !== subscription.planVariant.billingCycle) continue
                    if (variant.id === subscription.planVariant.id) continue
                    catalogOptions.push({
                      planId: detail.plan.id,
                      planName: detail.plan.name,
                      variantId: variant.id,
                      finalPrice: variant.finalPrice,
                      isCurrent: false,
                    })
                  }
                }
                catalogOptions.sort((a, b) => a.finalPrice - b.finalPrice)

                const currentOption: PlanOption = {
                  planId: subscription.plan.id,
                  planName: subscription.plan.name,
                  variantId: subscription.planVariant.id,
                  finalPrice: subscription.planVariant.finalPrice,
                  isCurrent: true,
                }

                setState({
                  status: 'ready',
                  subscription,
                  options: [currentOption, ...catalogOptions],
                })
              })
            })
          })
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

  const selectedOption =
    state.status === 'ready'
      ? (state.options.find((o) => o.variantId === selectedVariantId) ?? null)
      : null

  const preview = useMemo(() => {
    if (state.status !== 'ready' || !selectedOption) return null
    const { subscription } = state
    const total = totalPeriodDays(subscription.startDate, subscription.endDate)
    const remaining = subscription.remainingDays
    if (total <= 0) return null
    // `diferenca` replica o arredondamento ÚNICO do backend real
    // (prorate() em rallye-api/.../subscriptions/handler.go: `diff :=
    // newPrice - currentPrice; round2((remaining/total) * diff)`) —
    // corrigido em correction round 1 (review de BEAC-1938): a versão
    // anterior arredondava `creditRestante`/`novoValor` separadamente e
    // subtraía os dois já arredondados, o que diverge do backend em até 1
    // centavo sempre que remaining/total não divide exatamente (ex.:
    // remaining=1, total=3). `creditRestante`/`novoValor` abaixo continuam
    // existindo só pro breakdown visual — nunca alimentam `diferenca`.
    const priceDelta = selectedOption.finalPrice - subscription.planVariant.finalPrice
    const diferenca = round2((remaining / total) * priceDelta)
    const creditRestante = round2((subscription.planVariant.finalPrice * remaining) / total)
    const novoValor = round2((selectedOption.finalPrice * remaining) / total)
    return { creditRestante, novoValor, diferenca, remaining }
  }, [state, selectedOption])

  async function handleConfirm() {
    if (state.status !== 'ready' || !selectedOption) return
    setConfirming(true)
    setConfirmError(null)
    const result = await changePlan(state.subscription.id, selectedOption.variantId)
    setConfirming(false)
    if (!result.ok) {
      setConfirmError('Não foi possível confirmar a troca de plano. Tente novamente.')
      return
    }
    if (result.invoice) {
      navigate(`/invoices/${result.invoice.id}`)
      return
    }
    setDowngradeCredit(round2(-result.proratedAmount))
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <IconButton
          variant="ghost"
          size="sm"
          label="Voltar"
          onClick={() => unitId && navigate(`/units/${unitId}/my-subscription`)}
        >
          ←
        </IconButton>
        <h1>Trocar Plano</h1>
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <PageLoading label="Carregando planos" variant="list" /> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar sua assinatura.</p>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <Card padding="var(--space-4)">
              <div className="current-plan-card">
                <h3>{state.subscription.plan.name}</h3>
                <div className="kv">
                  <span className="k">Recorrência</span>
                  <span className="v">
                    {CYCLE_LABELS[state.subscription.planVariant.billingCycle]} ·{' '}
                    {formatBRL(state.subscription.planVariant.finalPrice)}/mês
                  </span>
                </div>
                <span className="v">
                  {state.subscription.remainingDays}{' '}
                  {state.subscription.remainingDays === 1 ? 'dia restante' : 'dias restantes'}
                </span>
              </div>
            </Card>

            <h2 className="sec-head-title">Selecione o novo plano</h2>
            <div className="plan-options">
              {state.options.map((option) => {
                const isSelected = option.variantId === selectedVariantId
                const diff = option.finalPrice - state.subscription.planVariant.finalPrice
                return (
                  <label
                    key={option.variantId}
                    data-testid={`plan-option-${option.variantId}`}
                    className={[
                      'radio-opt',
                      isSelected ? 'checked' : '',
                      option.isCurrent ? 'disabled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <input
                      type="radio"
                      name="pl5-plan-variant"
                      checked={isSelected}
                      disabled={option.isCurrent}
                      onChange={() => setSelectedVariantId(option.variantId)}
                    />
                    <span className="opt-body">
                      <span className="opt-name">
                        {option.planName}
                        {option.isCurrent ? ' (atual)' : ''}
                      </span>
                      <span className="opt-price">{formatBRL(option.finalPrice)}/mês</span>
                    </span>
                    {!option.isCurrent && diff !== 0 ? (
                      <Badge tone={diff > 0 ? 'warning' : 'success'}>
                        {diff > 0 ? '↑ Upgrade' : '↓ Downgrade'}
                      </Badge>
                    ) : null}
                  </label>
                )
              })}
            </div>

            {preview && selectedOption ? (
              <Card padding="var(--space-4)">
                <div className="calc-card">
                  <h2 className="sec-head-title">Cálculo pro-rata</h2>
                  {preview.diferenca > 0 ? (
                    <>
                      <p className="calc-row">
                        Crédito restante: {formatBRL(preview.creditRestante)}
                      </p>
                      <p className="calc-row">
                        Novo valor ({preview.remaining}d): {formatBRL(preview.novoValor)}
                      </p>
                      <p className="calc-row total">Diferença: {formatBRL(preview.diferenca)}</p>
                    </>
                  ) : (
                    <p className="calc-row total">
                      Crédito de {formatBRL(-preview.diferenca)} aplicado
                    </p>
                  )}
                </div>
              </Card>
            ) : null}

            {confirmError ? <p role="alert">{confirmError}</p> : null}

            <Button
              variant="primary"
              fullWidth
              disabled={!selectedOption || confirming}
              onClick={handleConfirm}
            >
              {preview && preview.diferenca > 0
                ? `CONFIRMAR TROCA — ${formatBRL(preview.diferenca)}`
                : 'CONFIRMAR TROCA'}
            </Button>
          </>
        ) : null}
      </div>

      <BottomSheet
        open={downgradeCredit !== null}
        onClose={() => setDowngradeCredit(null)}
        label="Troca confirmada"
      >
        <div className="stack">
          <h2 className="sec-head-title">Troca confirmada</h2>
          <p className="calc-row total">Crédito de {formatBRL(downgradeCredit ?? 0)} aplicado</p>
          <p className="hint">
            O crédito é aplicado nas próximas faturas — a troca de plano nunca gera devolução em
            dinheiro.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => unitId && navigate(`/units/${unitId}/my-subscription`)}
          >
            Voltar
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  )
}
