import { useState } from 'react'
import type {
  Earnings,
  EarningsBreakdownEntry,
  EarningsHistoryEntry,
} from '../../lib/api/earnings'
import type { RemunerationModel } from '../../lib/api/teachers'
import { formatBRL } from '../../lib/money'
import { formatRemunerationSummary } from './teachersShared'

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
 * Corpo de apresentação compartilhado entre TeacherEarningsPage (PR4, visão
 * Admin de outro professor) e MyEarningsPage (BEAC-2095, self-view do
 * próprio professor) — extraído de TeacherEarningsPage.tsx para não duplicar
 * o JSX/lógica de exibição (AC de BEAC-2095). Ambas as páginas mantêm seu
 * próprio header/back-link/estado de loading/erro; só o corpo "pronto"
 * (banner somente-leitura, stat4, seletor de mês, gráfico, detalhamento por
 * turma) vive aqui. Estado de mês selecionado é interno — cada instância
 * começa no período mais recente do histórico.
 */
export function EarningsSummary({
  earnings,
  remunerationValue,
}: {
  earnings: Earnings
  remunerationValue: number
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(
    earnings.history.length > 0 ? earnings.history[earnings.history.length - 1].period : null,
  )

  return (
    <div className="earnings-panel">
      <div className="readonly-banner" role="status">
        Somente leitura — os valores são calculados automaticamente pelo sistema (fechamento
        mensal) e conferidos pelo admin.
      </div>

      <div className="stat4">
        <Stat label="Modelo" value={formatRemunerationSummary(earnings.remunerationModel, remunerationValue)} />
        <Stat label="Aulas dadas" value={String(earnings.classesGivenInPeriod)} />
        <Stat label="A receber" value={formatBRL(earnings.pendingAmount)} pending />
        <Stat label="Já recebido" value={formatBRL(earnings.paidAmount)} received />
      </div>

      <MonthSelector history={earnings.history} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} />

      <div className="chart-wrap">
        <div className="sec-head" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 13 }}>Histórico mensal</h2>
        </div>
        <MonthlyChart history={earnings.history} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} />
      </div>

      <ClassBreakdownSection breakdown={earnings.breakdown} remunerationModel={earnings.remunerationModel} />

      <p className="hint">
        Cálculo em <code>commission_records</code>, fechamento por cron mensal.
      </p>
    </div>
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
    ? { fontSize: 17, color: 'var(--state-warning-text)' }
    : received
      ? { fontSize: 17, color: 'var(--state-success)' }
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
        <button key={entry.period} type="button" className="mb mb--button" onClick={() => onSelect(entry.period)}>
          <div
            className="bar"
            style={{
              height: `${Math.max(4, (entry.amount / maxAmount) * 52)}px`,
              background: entry.period === selectedPeriod ? 'var(--interactive-primary)' : undefined,
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
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)' }}>{formatBRL(entry.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
