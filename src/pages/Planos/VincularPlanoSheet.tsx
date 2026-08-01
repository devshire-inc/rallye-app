import { useCallback, useEffect, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { listMembers, type Member } from '../../lib/api/members'
import {
  getPlanForEdit,
  listPlans,
  type BillingCycle,
  type PlanDetail,
  type PlanSummary,
} from '../../lib/api/plans'
import {
  createSubscription,
  getSubscription,
  type PaymentMethod,
  type Subscription,
  type SubscriptionDetail,
  type SubscriptionInvoice,
} from '../../lib/api/subscriptions'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './VincularPlanoSheet.css'

export interface VincularPlanoSheetProps {
  unitId: string
  onClose: () => void
  /** Chamado quando o admin confirma a tela de sucesso ("Concluir") — sinal
   * pro pai fechar o sheet e, se fizer sentido, atualizar qualquer lista que
   * dependa do estado da assinatura (ex.: "N assinantes" em PL1). */
  onLinked: () => void
}

/** Rótulo PT-BR de cada `billing_cycle` (mesmo vocabulário de
 * PlanoFormPage.tsx CYCLE_DEFAULTS, mas este arquivo não os exporta —
 * duplicação mínima intencional, mesmo padrão já aceito no projeto, ver
 * comentário de pacote em subscriptions/handler.go do backend). */
const CYCLE_LABELS: Record<BillingCycle, string> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'dinheiro', label: 'Dinheiro' },
]

interface SelectedStudent {
  id: string
  name: string
  email: string | null
}

type StudentSearchState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; students: Member[] }

/** Resultado da checagem "aluno já tem plano ativo?" (BEAC-1974, regra 6
 * parcial — só o aviso, sem o botão "substituir"). `'none'` cobre tanto o
 * 404 esperado (`subscription_not_found`) quanto qualquer outro erro
 * (403/500) — nesses casos o aviso simplesmente não aparece, não trava o
 * fluxo (ver comentário de pacote em ../../lib/api/subscriptions.ts). */
type ActiveSubscriptionCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'active'; subscription: SubscriptionDetail }

type PlansState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; plans: PlanSummary[] }

type VariantsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; plan: PlanDetail }

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | {
      status: 'success'
      subscription: Subscription
      periodTotal: number
      invoice: SubscriptionInvoice | null
    }

function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Mensagem de erro do submit (POST /students/{id}/subscriptions). O caso
 * 409 (`active_subscription_exists`, BEAC-1973) é tratado ANTES do fallback
 * genérico `if (message) return message` de propósito: a mensagem que o
 * backend devolve nesse corpo é fixa e genérica
 * ("aluno já tem uma assinatura ativa", writeActiveSubscriptionExists em
 * subscriptions/handler.go) — não identifica QUAL assinatura. BEAC-1974 pede
 * uma mensagem clara reaproveitando os dados do 409 (nome/id da assinatura
 * existente): o nome do plano vem do cache local da checagem feita ao
 * selecionar o aluno (`activeSubscriptionName`, ver `ActiveSubscriptionCheck`
 * acima); se esse cache não tiver o nome (ex.: corrida — a assinatura foi
 * criada depois do 404 daquela checagem), cai para o `subscription_id` que o
 * próprio 409 devolve. */
function errorMessageFor(
  status: number,
  error: string,
  message: string | undefined,
  activeSubscriptionName: string | null,
  subscriptionId: string | undefined,
): string {
  if (status === 409 || error === 'active_subscription_exists') {
    if (activeSubscriptionName) {
      return `Aluno já tem plano ativo: ${activeSubscriptionName}. Cancele a assinatura atual antes de vincular um novo plano.`
    }
    return subscriptionId
      ? `Aluno já tem uma assinatura ativa (id ${subscriptionId}). Cancele a assinatura atual antes de vincular um novo plano.`
      : 'Aluno já tem uma assinatura ativa. Cancele a assinatura atual antes de vincular um novo plano.'
  }
  if (message) return message
  if (status === 403 || error === 'forbidden') {
    return 'Você não tem permissão para vincular este aluno a um plano.'
  }
  if (status === 404 || error === 'student_not_found') {
    return 'Aluno não encontrado.'
  }
  return 'Não foi possível vincular o plano agora. Tente novamente.'
}

/**
 * Conteúdo do BottomSheet PL3 — "Vincular Aluno a Plano" (BEAC-1936, story
 * BEAC-1927). Campos/layout lidos diretamente da doc real do protótipo
 * (Allye docs, `#sheet-pl3`): Aluno (busca), Plano (select), Recorrência
 * (tabs com preço de cada variante), Início (data), Método de pagamento
 * (PIX/Cartão/Dinheiro), checkboxes Renovação automática/Gerar primeira
 * fatura agora, botão de confirmação.
 *
 * # Busca de aluno — mesmo endpoint/filtro de AddStudentSheet.tsx (BEAC-1918)
 *
 * Não existe endpoint de busca dedicado a alunos (`GET /units/{id}/students`
 * de busca nunca foi pedido em nenhuma task) — reaproveita GET
 * /units/{id}/members?q= (../../lib/api/members.ts), filtrando client-side
 * por `role.name === 'Aluno'`, exatamente como AddStudentSheet.tsx já faz
 * pro mesmo problema em outra tela.
 *
 * # "Total do período" só existe DEPOIS de confirmar — sem preview
 *
 * BEAC-1932 (POST /students/{id}/subscriptions) não tem endpoint de
 * simulação — o único jeito de saber o total do período é chamando a
 * criação de verdade (ver comentário de pacote em ../../lib/api/
 * subscriptions.ts). Por isso este sheet não mostra um "Resumo" com total
 * pré-cálculo antes do clique: as tabs de Recorrência já mostram o preço
 * mensal de cada variante (`variant.finalPrice`, valor da API, sem nenhuma
 * conta no frontend); "Total do período" só aparece na tela de confirmação
 * depois que POST /students/{id}/subscriptions responde, usando
 * `period_total` da resposta — nunca `finalPrice * meses` calculado aqui.
 *
 * # Regra 6 (aviso de assinatura já ativa) — BEAC-1974, parcial
 *
 * Regra 6 da doc ("Se aluno já tem plano ativo, mostra aviso: 'Aluno já tem
 * plano ativo. Deseja substituir?'") não estava nos ACs de BEAC-1936 (só
 * ficou disponível depois de BEAC-1972/GET /students/{id}/subscription e
 * BEAC-1973/409 active_subscription_exists). BEAC-1974 implementa a metade
 * informativa: ao selecionar o Aluno, `activeSubscriptionCheck` consulta
 * BEAC-1972 (escopado pela unit ativa do chamador) e mostra o aviso se
 * houver uma assinatura ativa; o botão "substituir" da doc NÃO está
 * implementado (locked decision) — o aviso é só informativo, o submit
 * continua habilitado e, se colidir com o 409 de BEAC-1973, mostra uma
 * mensagem de erro específica em vez da genérica (ver `errorMessageFor`
 * acima). Wiring a partir de AL2 (aba Plano) continua fora de escopo —
 * aquela aba continua como stub "Em breve" (StudentProfilePage.tsx); este
 * sheet só está conectado a partir de PL1 (PlanosListPage.tsx, botão
 * "Vincular aluno").
 */
export function VincularPlanoSheet({ unitId, onClose, onLinked }: VincularPlanoSheetProps) {
  const [studentQuery, setStudentQuery] = useState('')
  const debouncedStudentQuery = useDebouncedValue(studentQuery, 300)
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null)
  const [searchState, setSearchState] = useState<StudentSearchState>({ status: 'loading' })

  const [plansState, setPlansState] = useState<PlansState>({ status: 'loading' })
  const [planId, setPlanId] = useState('')
  const [variantsState, setVariantsState] = useState<VariantsState>({ status: 'idle' })
  const [variantId, setVariantId] = useState('')

  const [startDate, setStartDate] = useState(todayISO())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [autoRenew, setAutoRenew] = useState(true)
  const [generateFirstInvoice, setGenerateFirstInvoice] = useState(true)

  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' })

  const [activeSubscriptionCheck, setActiveSubscriptionCheck] = useState<ActiveSubscriptionCheck>({
    status: 'idle',
  })

  /** BEAC-1974 (regra 6, parcial) — ao selecionar um Aluno, consulta GET
   * /students/{id}/subscription (BEAC-1972, já escopado pelo backend à unit
   * ativa do chamador — ver comentário de pacote em
   * ../../lib/api/subscriptions.ts) pra saber se ele já tem uma assinatura
   * ativa NESTA unit. 200 → mostra o aviso informativo; 404
   * (`subscription_not_found`) é o caminho normal, sem aviso; qualquer outro
   * erro (403/500) também não mostra aviso — não é o que esta task cobre, e
   * não deve travar o fluxo de vincular.
   *
   * A transição pra `'checking'`/`'idle'` acontece nos handlers de clique
   * (seleção/"Trocar" abaixo), não aqui dentro — mesmo padrão já usado pelo
   * efeito de `variantsState`/`handlePlanChange` acima: setState síncrono no
   * corpo de um efeito é o antipattern que o lint `react-hooks/set-state-in-
   * effect` pega; este efeito só cuida do fetch assíncrono em si. */
  useEffect(() => {
    if (!selectedStudent) return
    let cancelled = false
    getSubscription(selectedStudent.id).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setActiveSubscriptionCheck({ status: 'active', subscription: result.subscription })
        return
      }
      setActiveSubscriptionCheck({ status: 'none' })
    })
    return () => {
      cancelled = true
    }
  }, [selectedStudent])

  const loadStudents = useCallback(
    (onCancelled: () => boolean) => {
      if (selectedStudent) return
      listMembers(unitId, debouncedStudentQuery)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setSearchState({ status: 'error' })
            return
          }
          setSearchState({
            status: 'ready',
            students: result.members.filter((m) => m.role?.name === 'Aluno'),
          })
        })
        .catch(() => {
          if (onCancelled()) return
          setSearchState({ status: 'error' })
        })
    },
    [unitId, debouncedStudentQuery, selectedStudent],
  )

  useEffect(() => {
    let cancelled = false
    loadStudents(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadStudents])

  const loadPlans = useCallback(
    (onCancelled: () => boolean) => {
      listPlans(unitId).then((result) => {
        if (onCancelled()) return
        if (!result.ok) {
          setPlansState({ status: 'error' })
          return
        }
        const plans = result.groups.flatMap((g) => g.plans).filter((p) => p.isActive)
        setPlansState({ status: 'ready', plans })
      })
    },
    [unitId],
  )

  useEffect(() => {
    let cancelled = false
    loadPlans(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadPlans])

  useEffect(() => {
    if (!planId) return
    let cancelled = false
    getPlanForEdit(planId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setVariantsState({ status: 'error' })
        return
      }
      setVariantsState({ status: 'ready', plan: result.plan })
    })
    return () => {
      cancelled = true
    }
  }, [planId])

  /** Disparado pelo próprio evento `onChange` do `<select>` (não por um
   * `useEffect` reagindo à mudança de `planId`) — setState síncrono aqui é
   * seguro, é dentro de um handler de evento, não do corpo de um efeito
   * (evita o lint `react-hooks/set-state-in-effect`). O efeito acima só cuida
   * do fetch assíncrono em si. */
  function handlePlanChange(id: string) {
    setPlanId(id)
    setVariantId('')
    setVariantsState(id ? { status: 'loading' } : { status: 'idle' })
  }

  const activeVariants =
    variantsState.status === 'ready' ? variantsState.plan.variants.filter((v) => v.isActive) : []

  const canSubmit =
    selectedStudent !== null &&
    variantId !== '' &&
    startDate !== '' &&
    paymentMethod !== '' &&
    submitState.status !== 'submitting'

  async function handleSubmit() {
    if (!selectedStudent || !variantId || !paymentMethod) return
    setSubmitState({ status: 'submitting' })
    const result = await createSubscription(selectedStudent.id, {
      planVariantId: variantId,
      startDate,
      paymentMethod,
      autoRenew,
      generateFirstInvoice,
    })
    if (!result.ok) {
      const activeSubscriptionName =
        activeSubscriptionCheck.status === 'active'
          ? activeSubscriptionCheck.subscription.plan.name
          : null
      setSubmitState({
        status: 'error',
        message: errorMessageFor(
          result.status,
          result.error,
          result.message,
          activeSubscriptionName,
          result.subscriptionId,
        ),
      })
      return
    }
    setSubmitState({
      status: 'success',
      subscription: result.subscription,
      periodTotal: result.periodTotal,
      invoice: result.invoice,
    })
  }

  if (submitState.status === 'success') {
    const plan = variantsState.status === 'ready' ? variantsState.plan : null
    const variant = plan?.variants.find((v) => v.id === submitState.subscription.planVariantId)
    return (
      <div className="vp-sheet">
        <h2 className="sec-head-title">Plano vinculado</h2>
        <p role="status" className="vp-success-msg">
          {selectedStudent?.name} foi vinculado ao plano{plan ? ` "${plan.name}"` : ''}.
        </p>
        <div className="vp-summary">
          {plan && variant ? (
            <p className="vp-summary-line">
              {plan.name} · {CYCLE_LABELS[variant.billingCycle]} · R${' '}
              {formatPrice(variant.finalPrice)}/mês
            </p>
          ) : null}
          <p className="vp-summary-line">
            {formatDate(submitState.subscription.startDate)} a{' '}
            {formatDate(submitState.subscription.endDate)}
          </p>
          <p className="vp-summary-total">
            Total do período: R$ {formatPrice(submitState.periodTotal)}
          </p>
          {submitState.invoice ? (
            <p className="hint">
              Primeira fatura gerada: R$ {formatPrice(submitState.invoice.amount)} · vencimento{' '}
              {formatDate(submitState.invoice.dueDate)}.
            </p>
          ) : null}
        </div>
        <button type="button" className="btn btn-primary btn-full" onClick={onLinked}>
          Concluir
        </button>
      </div>
    )
  }

  return (
    <div className="vp-sheet">
      <h2 className="sec-head-title">Vincular aluno a plano</h2>

      <div className="field">
        <span>Aluno</span>
        {selectedStudent ? (
          <div className="vp-selected-student">
            <span className="avatar-sm">{initials(selectedStudent.name)}</span>
            <div className="vp-selected-student-info">
              <div className="nm">{selectedStudent.name}</div>
              {selectedStudent.email ? <div className="mt">{selectedStudent.email}</div> : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSelectedStudent(null)
                setStudentQuery('')
                setActiveSubscriptionCheck({ status: 'idle' })
              }}
            >
              Trocar
            </button>
          </div>
        ) : null}
        {activeSubscriptionCheck.status === 'active' ? (
          <p role="status" className="vp-warning">
            Aluno já tem plano ativo: {activeSubscriptionCheck.subscription.plan.name}. Vincular um
            novo plano será bloqueado até a assinatura atual ser cancelada.
          </p>
        ) : null}
        {!selectedStudent && (
          <>
            <input
              type="text"
              placeholder="Nome ou e-mail..."
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              aria-label="Buscar aluno"
            />
            {searchState.status === 'loading' ? <PageLoading label="Carregando alunos" variant="list" rows={3} /> : null}
            {searchState.status === 'error' ? (
              <p role="alert">Não foi possível buscar alunos agora.</p>
            ) : null}
            {searchState.status === 'ready' ? (
              <div className="vp-student-list">
                {searchState.students.length === 0 ? (
                  <p className="hint">Nenhum aluno encontrado.</p>
                ) : (
                  searchState.students.map((student) => (
                    <button
                      type="button"
                      key={student.membershipId}
                      className="vp-student-row"
                      onClick={() => {
                        setSelectedStudent({
                          id: student.user.id,
                          name: student.user.name,
                          email: student.user.email,
                        })
                        setActiveSubscriptionCheck({ status: 'checking' })
                      }}
                    >
                      <span className="avatar-sm">{initials(student.user.name)}</span>
                      <div>
                        <div className="nm">{student.user.name}</div>
                        {student.user.email ? <div className="mt">{student.user.email}</div> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      <label className="field">
        <span>Plano</span>
        {plansState.status === 'loading' ? <PageLoading label="Carregando planos" variant="field" /> : null}
        {plansState.status === 'error' ? (
          <p role="alert">Não foi possível carregar os planos desta arena.</p>
        ) : null}
        {plansState.status === 'ready' ? (
          <select value={planId} onChange={(e) => handlePlanChange(e.target.value)}>
            <option value="">Selecione um plano</option>
            {plansState.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        ) : null}
      </label>

      {planId ? (
        <div className="field">
          <span>Recorrência</span>
          {variantsState.status === 'loading' ? <PageLoading label="Carregando variantes" variant="field" /> : null}
          {variantsState.status === 'error' ? (
            <p role="alert">Não foi possível carregar as variantes deste plano.</p>
          ) : null}
          {variantsState.status === 'ready' ? (
            activeVariants.length === 0 ? (
              <p className="hint">Este plano não tem variantes ativas.</p>
            ) : (
              <div className="tabs2" role="group" aria-label="Recorrência">
                {activeVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={variantId === variant.id ? 'active' : ''}
                    aria-pressed={variantId === variant.id}
                    onClick={() => setVariantId(variant.id)}
                  >
                    {CYCLE_LABELS[variant.billingCycle]} R$ {formatPrice(variant.finalPrice)}
                  </button>
                ))}
              </div>
            )
          ) : null}
        </div>
      ) : null}

      <label className="field">
        <span>Início</span>
        <input
          type="date"
          value={startDate}
          min={todayISO()}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </label>

      <div className="field">
        <span>Método de pagamento</span>
        <div className="tabs2" role="group" aria-label="Método de pagamento">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.value}
              type="button"
              className={paymentMethod === method.value ? 'active' : ''}
              aria-pressed={paymentMethod === method.value}
              onClick={() => setPaymentMethod(method.value)}
            >
              {method.label}
            </button>
          ))}
        </div>
      </div>

      <label className="vp-checkbox">
        <input
          type="checkbox"
          checked={autoRenew}
          onChange={(e) => setAutoRenew(e.target.checked)}
        />
        Renovação automática
      </label>

      <label className="vp-checkbox">
        <input
          type="checkbox"
          checked={generateFirstInvoice}
          onChange={(e) => setGenerateFirstInvoice(e.target.checked)}
        />
        Gerar primeira fatura agora
      </label>

      {submitState.status === 'error' ? <p role="alert">{submitState.message}</p> : null}

      <button
        type="button"
        className="btn btn-primary btn-full"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
      >
        {submitState.status === 'submitting'
          ? 'Vinculando…'
          : generateFirstInvoice
            ? 'Vincular e gerar fatura'
            : 'Vincular plano'}
      </button>

      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
        Cancelar
      </button>
    </div>
  )
}
