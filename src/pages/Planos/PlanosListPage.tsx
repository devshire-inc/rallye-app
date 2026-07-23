import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { usePermission } from '../../hooks/usePermission'
import { listPlans, type PlanSummary } from '../../lib/api/plans'
import { sportCssVar, sportLabel } from '../../lib/sports'
import { VincularPlanoSheet } from './VincularPlanoSheet'
import '../../components/AuthLayout/AuthLayout.css'
import './PlanosListPage.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; sections: Section[] }

/** Uma seção da tela (PL1 doc: "Agrupamento: Por esporte + seções especiais
 * (Pacotes, Família)"). `key` identifica a seção pro React; `sport` só é
 * preenchido pras seções de esporte "normais" (usado pro dot colorido). */
interface Section {
  key: string
  title: string
  sport: string | null
  plans: PlanSummary[]
}

/** PL1 — Catálogo de Planos (Admin) (BEAC-1934, story BEAC-1927 — "Planos e
 * Assinaturas"). Layout/copy lidos diretamente da doc real do protótipo
 * (Allye docs, "Financeiro" > "PL1 — Catálogo de Planos (Admin)"): planos
 * agrupados por esporte + seções especiais Pacotes/Família, card com nome,
 * "N variantes · M assinantes", preço "a partir de", badge Ativo/Inativo.
 *
 * GET /units/{id}/plans (BEAC-1931) já agrupa por esporte no backend — esta
 * página faz uma segunda passada em memória pra separar Pacotes (type=
 * 'pacote') e Família (max_members>1) das seções de esporte "normais", que
 * o backend não modela como conceito próprio (só agrupa por `sport`,
 * comentário de pacote em rallye-api/api/internal/plans/handler.go).
 * Precedência quando um plano é família E pacote ao mesmo tempo (caso raro,
 * não coberto pela doc): Pacotes primeiro, mesma ordem do mockup real.
 */
export default function PlanosListPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const canManage = usePermission('financeiro', 'write')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showVincularInfo, setShowVincularInfo] = useState(false)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request = unitId ? listPlans(unitId) : Promise.reject(new Error('missing_unit_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', sections: toSections(result.groups) })
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

  const sections = useMemo(() => (state.status === 'ready' ? state.sections : []), [state])

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
      <div className="pg-head">
        <button
          type="button"
          className="btn-back"
          onClick={() => unitId && navigate(`/units/${unitId}/dashboard`)}
          aria-label="Voltar"
        >
          ←
        </button>
        <h1>Planos e Pacotes</h1>
        <div className="spacer" />
        {canManage ? (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowVincularInfo(true)}
            >
              Vincular aluno
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              aria-label="Novo plano"
              onClick={() => unitId && navigate(`/units/${unitId}/plans/new`)}
            >
              + Novo plano
            </button>
          </>
        ) : null}
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <p role="status">Carregando planos…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar os planos desta arena.</p>
        ) : null}

        {state.status === 'ready' ? (
          sections.length === 0 ? (
            <p className="hint">Nenhum plano cadastrado.</p>
          ) : (
            sections.map((section) => (
              <div key={section.key} className="plan-section">
                <h2 className="plan-section-title">
                  {section.sport ? (
                    <span
                      className="sdot"
                      style={{ background: `var(${sportCssVar(section.sport)})` }}
                    />
                  ) : null}
                  {section.title}
                </h2>
                <div className="plan-list">
                  {section.plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onClick={() => unitId && navigate(`/units/${unitId}/plans/${plan.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))
          )
        ) : null}
      </div>

      <BottomSheet
        open={showVincularInfo}
        onClose={() => setShowVincularInfo(false)}
        label="Vincular aluno"
      >
        {unitId ? (
          <VincularPlanoSheet
            unitId={unitId}
            onClose={() => setShowVincularInfo(false)}
            onLinked={() => {
              setShowVincularInfo(false)
              load(() => false)
            }}
          />
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}

function toSections(groups: { sport: string | null; plans: PlanSummary[] }[]): Section[] {
  const pacotes: PlanSummary[] = []
  const familia: PlanSummary[] = []
  const bySport = new Map<string, PlanSummary[]>()
  const semEsporte: PlanSummary[] = []

  for (const group of groups) {
    for (const plan of group.plans) {
      if (plan.type === 'pacote') {
        pacotes.push(plan)
        continue
      }
      if (plan.maxMembers > 1) {
        familia.push(plan)
        continue
      }
      if (group.sport) {
        const list = bySport.get(group.sport) ?? []
        list.push(plan)
        bySport.set(group.sport, list)
      } else {
        semEsporte.push(plan)
      }
    }
  }

  const sections: Section[] = []
  for (const [sport, plans] of bySport) {
    sections.push({ key: `sport-${sport}`, title: sportLabel(sport), sport, plans })
  }
  if (semEsporte.length > 0) {
    sections.push({ key: 'sem-esporte', title: 'Outros', sport: null, plans: semEsporte })
  }
  if (pacotes.length > 0) {
    sections.push({ key: 'pacotes', title: 'Pacotes', sport: null, plans: pacotes })
  }
  if (familia.length > 0) {
    sections.push({ key: 'familia', title: 'Família', sport: null, plans: familia })
  }
  return sections
}

function PlanCard({ plan, onClick }: { plan: PlanSummary; onClick: () => void }) {
  const priceLabel =
    plan.startingPrice === null
      ? 'Sem variantes ativas'
      : plan.type === 'pacote'
        ? `R$ ${formatPrice(plan.startingPrice)} · preço único`
        : `A partir de R$ ${formatPrice(plan.startingPrice)}/mês`

  return (
    <button
      type="button"
      className={`plan-card${plan.isActive ? '' : ' inactive'}`}
      onClick={onClick}
      data-testid={`plan-card-${plan.id}`}
    >
      <span className="pc-main">
        <h3>{plan.name}</h3>
        <span className="mt">{priceLabel}</span>
        <span className="mt">
          {plan.variantCount} {plan.variantCount === 1 ? 'variante' : 'variantes'} ·{' '}
          {plan.activeSubscriberCount}{' '}
          {plan.activeSubscriberCount === 1 ? 'assinante' : 'assinantes'}
        </span>
      </span>
      <span className={`badge ${plan.isActive ? 'badge-ativo' : 'badge-inativa'}`}>
        {plan.isActive ? 'Ativo' : 'Inativo'}
      </span>
    </button>
  )
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
