import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import {
  getEarnings,
  type Earnings,
  type EarningsBreakdownEntry,
  type EarningsHistoryEntry,
} from '../../lib/api/earnings'
import { getTeacher, type RemunerationModel } from '../../lib/api/teachers'
import { formatBRL } from '../../lib/money'
import { formatRemunerationSummary } from './teachersShared'
import '../../components/AuthLayout/AuthLayout.css'
import '../Students/NewStudentPage.css'
import './TeacherProfilePage.css'
import './TeacherEarningsPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; earnings: Earnings; remunerationValue: number }

const MONTH_ABBREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function monthOf(period: string): number {
  return Number(period.slice(5, 7)) - 1
}
function yearOf(period: string): string {
  return period.slice(0, 4)
}
function monthAbbrev(period: string): string {
  return MONTH_ABBREV[monthOf(period)] ?? period
}
function monthYearLabel(period: string): string {
  return `${MONTH_FULL[monthOf(period)] ?? period} ${yearOf(period)}`
}

/**
 * PR4 — Meus Ganhos (BEAC-1700/BEAC-1884, story BEAC-1699/feature BEAC-1635
 * wave 1). Sem doc própria no Allye (grep confirmado) — layout/copy lidos
 * diretamente do protótipo real (Artifact "Rallye — Pessoas & Turmas", seção
 * `scr-pr4`): toast fixo somente-leitura, stat4 (Modelo/Aulas dadas/A
 * receber/Já recebido), gráfico "Histórico mensal".
 *
 * ## Detalhamento de turma (BEAC-1701/BEAC-1886)
 *
 * Consome `earnings.breakdown` (BEAC-1885, novo campo do mesmo endpoint) —
 * SÓ populado para o modelo per_class (ver comentário de pacote
 * de src/lib/api/earnings.ts); fixed/commission mostram uma mensagem
 * explicando o gap em vez de uma lista vazia silenciosa. "Alunos/aula em
 * média" do protótipo NÃO é renderizado — sem fonte de dado real disponível
 * (AC desta task: não inventar a média, mostrar só a contagem de aulas).
 *

 * Mesma fonte de dados de PR2/aba Comissão (GET /teachers/{id}/earnings,
 * decisão travada do Épico 5: "os valores batem exatamente com a aba
 * Comissão de PR2") — mas usa os 6 meses inteiros de `history[]` (PR2/
 * Comissão usa só os últimos 3), e os campos do stat4 são outros
 * (classes_given_in_period/pending_amount/paid_amount, não
 * revenue_generated/current_month_amount).
 *
 * `remuneration_value` não vem de GET /earnings (só `remuneration_model`) —
 * mesmo gap que ComissaoTab (TeacherProfilePage.tsx) resolve recebendo o
 * value via prop do professor já carregado pela página-pai; aqui, como esta
 * é uma rota própria (sem página-pai carregando o professor), busca-se
 * também GET /teachers/{id} em paralelo só para esse valor.
 *
 * Autorização: SEM gate de permissão no frontend — GetHandler
 * (api/internal/earnings/handler.go) já faz bypass de self (o próprio
 * professor sempre acessa os próprios ganhos, mesmo sem professores:read,
 * que o role Professor não tem na matriz de seed) com fallback para
 * professores:read (Admin, "Ver como o professor vê" em PR2). Gatear aqui
 * com usePermission('professores','read') esconderia a tela do PRÓPRIO
 * professor, o oposto do que o backend garante.
 *
 * ## Acesso / PF2
 *
 * O AC pede acesso "via item de menu a partir de PF2 (Meu Perfil -
 * Professor)" — PF2 não existe nesta base ainda (grep confirmado, fora de
 * escopo desta task). O link "‹ Meu perfil" do protótipo aponta para cá;
 * como não há PF2, o back-link desta página volta para o perfil do
 * professor em PR2 (rota de onde o Admin efetivamente chega hoje, via botão
 * "Ver como o professor vê" da aba Comissão) — gap comentado, não construir
 * PF2 aqui.
 */
export default function TeacherEarningsPage() {
  const { unitId, teacherId } = useParams<{ unitId: string; teacherId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)

  useEffect(() => {
    if (!teacherId) return
    let cancelled = false

    Promise.all([getEarnings(teacherId), getTeacher(teacherId)]).then(
      ([earningsResult, teacherResult]) => {
        if (cancelled) return
        if (!earningsResult.ok || !teacherResult.ok) {
          setState({ status: 'error' })
          return
        }
        setState({
          status: 'ready',
          earnings: earningsResult.earnings,
          remunerationValue: teacherResult.teacher.remunerationValue,
        })
        const history = earningsResult.earnings.history
        if (history.length > 0) setSelectedPeriod(history[history.length - 1].period)
      },
    )
    return () => {
      cancelled = true
    }
  }, [teacherId])

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Professor">
      <div className="pg-head">
        <Link className="back" to={unitId && teacherId ? `/units/${unitId}/teachers/${teacherId}` : '/dashboard'}>
          ‹ Meu perfil
        </Link>
        <h1 style={{ fontSize: 18 }}>Meus ganhos</h1>
        <div className="spacer" />
      </div>

      {state.status === 'loading' ? <p role="status">Carregando ganhos…</p> : null}
      {state.status === 'error' ? <p role="alert">Não foi possível carregar seus ganhos.</p> : null}

      {state.status === 'ready' ? (
        <div className="dash-body earnings-panel">
          <div className="readonly-banner" role="status">
            Somente leitura — os valores são calculados automaticamente pelo sistema (fechamento
            mensal) e conferidos pelo admin.
          </div>

          <div className="stat4">
            <Stat
              label="Modelo"
              value={formatRemunerationSummary(state.earnings.remunerationModel, state.remunerationValue)}
            />
            <Stat label="Aulas dadas" value={String(state.earnings.classesGivenInPeriod)} />
            <Stat label="A receber" value={formatBRL(state.earnings.pendingAmount)} pending />
            <Stat label="Já recebido" value={formatBRL(state.earnings.paidAmount)} received />
          </div>

          <MonthSelector
            history={state.earnings.history}
            selectedPeriod={selectedPeriod}
            onSelect={setSelectedPeriod}
          />

          <div className="chart-wrap">
            <div className="sec-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 13 }}>Histórico mensal</h2>
            </div>
            <MonthlyChart
              history={state.earnings.history}
              selectedPeriod={selectedPeriod}
              onSelect={setSelectedPeriod}
            />
          </div>

          <ClassBreakdownSection
            breakdown={state.earnings.breakdown}
            remunerationModel={state.earnings.remunerationModel}
          />

          <p className="hint">
            Cálculo em <code>commission_records</code>, fechamento por cron mensal.
          </p>
        </div>
      ) : null}
    </AppShell>
  )
}

function Stat({
  label,
  value,
  pending,
  received,
}: {
  label: string
  value: string
  pending?: boolean
  received?: boolean
}) {
  const style = pending
    ? { fontSize: 17, color: 'var(--warning-fg)' }
    : received
      ? { fontSize: 17, color: 'var(--success-fg)' }
      : undefined
  return (
    <div className="s">
      <div className="l">{label}</div>
      <div className="v" style={style}>
        {value}
      </div>
    </div>
  )
}

function MonthSelector({
  history,
  selectedPeriod,
  onSelect,
}: {
  history: EarningsHistoryEntry[]
  selectedPeriod: string | null
  onSelect: (period: string) => void
}) {
  return (
    <div className="tabs2 month-selector" role="tablist" aria-label="Selecionar mês">
      {history.map((entry) => (
        <button
          key={entry.period}
          type="button"
          role="tab"
          aria-selected={entry.period === selectedPeriod}
          className={entry.period === selectedPeriod ? 'active' : ''}
          onClick={() => onSelect(entry.period)}
        >
          {monthYearLabel(entry.period)}
        </button>
      ))}
    </div>
  )
}

function MonthlyChart({
  history,
  selectedPeriod,
  onSelect,
}: {
  history: EarningsHistoryEntry[]
  selectedPeriod: string | null
  onSelect: (period: string) => void
}) {
  const maxAmount = Math.max(1, ...history.map((h) => h.amount))
  return (
    <div className="mini-bars">
      {history.map((entry) => (
        <button
          key={entry.period}
          type="button"
          className="mb mb--button"
          onClick={() => onSelect(entry.period)}
        >
          <div
            className="bar"
            style={{
              height: `${Math.max(4, (entry.amount / maxAmount) * 52)}px`,
              background: entry.period === selectedPeriod ? 'var(--accent)' : undefined,
            }}
            aria-label={`${monthAbbrev(entry.period)}: ${formatBRL(entry.amount)}`}
          />
          <span>{monthAbbrev(entry.period)}</span>
        </button>
      ))}
    </div>
  )
}

// EMPTY_BREAKDOWN_REASON: cópia para cada motivo pelo qual breakdown[] pode
// vir vazio (BEAC-1885/BEAC-1701) — nenhum é um erro, cada um é o
// comportamento correto e documentado do modelo (ver comentário de pacote
// de src/lib/api/earnings.ts e commission.Service.PeriodBreakdownByClass no
// backend). Gap explícito (AC desta task): "alunos/aula em média" não tem
// fonte de dado real — mostrado só a contagem de aulas, sem inventar média.
const EMPTY_BREAKDOWN_REASON: Record<RemunerationModel, string> = {
  fixed:
    'Detalhamento por turma não disponível para o modelo de remuneração fixo — o valor não é calculado por turma.',
  commission:
    'Detalhamento por turma não disponível para o modelo de comissão ainda (depende de integração financeira futura).',
  per_class: 'Nenhuma aula confirmada neste mês ainda.',
}

function ClassBreakdownSection({
  breakdown,
  remunerationModel,
}: {
  breakdown: EarningsBreakdownEntry[]
  remunerationModel: RemunerationModel
}) {
  return (
    <div>
      <div className="sec-head">
        <h2>Detalhamento do mês atual</h2>
      </div>
      {breakdown.length === 0 ? (
        <p className="hint">{EMPTY_BREAKDOWN_REASON[remunerationModel]}</p>
      ) : (
        <div className="ag-list" style={{ gap: 8 }}>
          {breakdown.map((entry) => (
            <div key={entry.classId} className="p-row" style={{ cursor: 'default' }}>
              <div className="pw">
                <div className="nm">{entry.className}</div>
                <div className="mt">
                  {entry.classCount} {entry.classCount === 1 ? 'aula' : 'aulas'}
                </div>
              </div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                {formatBRL(entry.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
