import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import {
  AvailabilityGrid,
  type AvailabilityGridReadCell,
} from '../../components/AvailabilityGrid/AvailabilityGrid'
import { Avatar } from '../../components/ui/Avatar/Avatar'
import { Badge } from '../../components/ui/Badge/Badge'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { usePermission } from '../../hooks/usePermission'
import { getAvailability } from '../../lib/api/availability'
import { listClasses, type RallyeClass } from '../../lib/api/classes'
import { getEarnings, type Earnings } from '../../lib/api/earnings'
import { getTeacher, type Teacher } from '../../lib/api/teachers'
import { formatDaysAndStart } from '../Turmas/turmasShared'
import { formatBRL } from '../../lib/money'
import { sportCssVar, sportLabel } from '../../lib/sports'
import { RemunerationSheet } from './RemunerationSheet'
import { formatRemunerationSummary } from './teachersShared'
import '../../components/AuthLayout/AuthLayout.css'
import './TeacherProfilePage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; teacher: Teacher }

type Tab = 'turmas' | 'horarios' | 'comissao' | 'bio'

/**
 * PR2 — Perfil do Professor (Admin View) (BEAC-1880, épico 5). Markup/copy
 * lidos diretamente do protótipo real (Artifact "Rallye — Pessoas & Turmas",
 * seção `scr-pr2`): header com avatar/nome/pill de certificação/contato/
 * dots de esporte, 4 sub-tabs (Turmas default, Horários, Comissão, Bio).
 *
 * ## Engrenagem [⚙️]
 *
 * Abre um menu (BottomSheet + RemunerationSheet.tsx) com "Editar dados"
 * (BEAC-1875, navega para PR3 em modo editar,
 * `/units/:unitId/teachers/:teacherId/edit`) e "Alterar remuneração" (PATCH
 * /teachers/{id}/remuneration) — "Relatório de performance" e "Desativar
 * professor" do doc real continuam sem endpoint correspondente, fora de
 * escopo (ver comentário de pacote de RemunerationSheet.tsx). Só visível com
 * `professores:write` — "esconder sempre, nunca desabilitar".
 *
 * ## Aba Turmas
 *
 * GET /units/{id}/classes?teacher_id={id} (filtro adicionado nesta mesma
 * story, Wave 1 backend) — reaproveita o cliente já existente
 * (listClasses), só passando o segundo argumento.
 *
 * ## Aba Horários
 *
 * PRIMEIRA vez que AvailabilityGrid (BEAC-1878) é plugado numa tela real —
 * mode="read", alimentado por GET /teachers/{id}/availability (BEAC-1877,
 * já existente). O estado "ocupado com aula" (busy) não tem nenhuma fonte de
 * dado real disponível nesta task (dependeria de agendamentos reais
 * cruzados com a disponibilidade, fora do escopo aqui) — todas as células
 * mapeiam só para available/unavailable, nunca busy (gap conhecido, mesmo
 * documentado no comentário de pacote do próprio componente).
 *
 * ## Aba Comissão — entrega real de BEAC-1880
 *
 * GET /teachers/{id}/earnings (BEAC-1699/BEAC-1883) — campos lidos
 * diretamente do handler real (ver src/lib/api/earnings.ts): stat4 com
 * Modelo/Aulas no mês/Receita gerada (só quando commission, "—" quando não
 * aplicável)/Comissão do mês (currentMonthAmount, achado desta story — ver
 * comentário de pacote de earnings.ts), gráfico de barras dos ÚLTIMOS 3
 * meses (o endpoint devolve 6, usamos só os 3 mais recentes pra bater com o
 * protótipo), hint fixo e botão para PR4 (BEAC-1700/BEAC-1884, "Meus
 * Ganhos" — TeacherEarningsPage.tsx, usa os 6 meses inteiros).
 *
 * ## Aba Bio
 *
 * Somente leitura (edição fica pra fora de escopo, mesmo espírito do menu ⚙️
 * simplificado acima) — texto livre de `teacher.bio`.
 */
export default function TeacherProfilePage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, teacherId } = useParams<{ unitId: string; teacherId: string }>()
  const navigate = useNavigate()
  const canManageRemuneration = usePermission('professores', 'write')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('turmas')
  const [remunerationOpen, setRemunerationOpen] = useState(false)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request = teacherId
        ? getTeacher(teacherId)
        : Promise.reject(new Error('missing_teacher_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState(result.status === 404 ? { status: 'not-found' } : { status: 'error' })
            return
          }
          setState({ status: 'ready', teacher: result.teacher })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [teacherId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const teacher = state.status === 'ready' ? state.teacher : null

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to={unitId ? `/units/${unitId}/teachers` : '/perfil'}>
          ‹ Professores
        </Link>
        <div className="spacer" />
        {canManageRemuneration && teacher ? (
          <IconButton variant="secondary" size="md" label="Ações" onClick={() => setRemunerationOpen(true)}>
            ⚙️
          </IconButton>
        ) : null}
      </div>

      {state.status === 'loading' ? <p role="status">Carregando professor…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar este professor.</p>
      ) : null}
      {state.status === 'not-found' ? <p role="alert">Professor não encontrado.</p> : null}

      {teacher ? (
        <>
          <TeacherHeader teacher={teacher} />

          <div className="ptabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'turmas'}
              className={tab === 'turmas' ? 'active' : ''}
              onClick={() => setTab('turmas')}
            >
              Turmas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'horarios'}
              className={tab === 'horarios' ? 'active' : ''}
              onClick={() => setTab('horarios')}
            >
              Horários
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'comissao'}
              className={tab === 'comissao' ? 'active' : ''}
              onClick={() => setTab('comissao')}
            >
              Comissão
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'bio'}
              className={tab === 'bio' ? 'active' : ''}
              onClick={() => setTab('bio')}
            >
              Bio
            </button>
          </div>

          <div className="dash-body">
            {tab === 'turmas' ? <TurmasTab unitId={unitId} teacherId={teacher.id} /> : null}
            {tab === 'horarios' ? <HorariosTab teacherId={teacher.id} /> : null}
            {tab === 'comissao' ? (
              <ComissaoTab
                unitId={unitId}
                teacherId={teacher.id}
                remunerationValue={teacher.remunerationValue}
              />
            ) : null}
            {tab === 'bio' ? <BioTab bio={teacher.bio} /> : null}
          </div>
        </>
      ) : null}

      <BottomSheet open={remunerationOpen} onClose={() => setRemunerationOpen(false)} label="Ações">
        {teacher ? (
          <RemunerationSheet
            teacherId={teacher.id}
            currentModel={teacher.remunerationModel}
            currentValue={teacher.remunerationValue}
            onUpdated={(model, value) => {
              setState({
                status: 'ready',
                teacher: { ...teacher, remunerationModel: model, remunerationValue: value },
              })
              setRemunerationOpen(false)
            }}
            onClose={() => setRemunerationOpen(false)}
            onEditData={() => {
              setRemunerationOpen(false)
              if (unitId) navigate(`/units/${unitId}/teachers/${teacher.id}/edit`)
            }}
          />
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}

function TeacherHeader({ teacher }: { teacher: Teacher }) {
  return (
    <div className="prof-head">
      <Avatar name={teacher.fullName} size={60} />
      <div className="ph-main">
        <h1>
          {teacher.fullName}{' '}
          {teacher.certifications ? <Badge tone="neutral">{teacher.certifications}</Badge> : null}
        </h1>
        <div className="mt">
          {teacher.email}
          {teacher.phone ? ` · ${teacher.phone}` : ''}
          {teacher.sports.length > 0 ? ' · ' : ''}
          {teacher.sports.map((sport) => (
            <span key={sport}>
              <span className="sdot" style={{ background: `var(${sportCssVar(sport)})` }} />{' '}
              {sportLabel(sport)}{' '}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

type TurmasState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; classes: RallyeClass[] }

function TurmasTab({ unitId, teacherId }: { unitId: string | undefined; teacherId: string }) {
  const navigate = useNavigate()
  const [state, setState] = useState<TurmasState>({ status: 'loading' })

  useEffect(() => {
    if (!unitId) return
    let cancelled = false
    listClasses(unitId, teacherId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', classes: result.classes })
    })
    return () => {
      cancelled = true
    }
  }, [unitId, teacherId])

  if (state.status === 'loading') return <p role="status">Carregando turmas…</p>
  if (state.status === 'error') return <p role="alert">Não foi possível carregar as turmas.</p>
  if (state.classes.length === 0) return <p className="hint">Nenhuma turma vinculada.</p>

  return (
    <div className="ag-list">
      {state.classes.map((classItem) => (
        <button
          type="button"
          key={classItem.id}
          className="ag-row"
          onClick={() => unitId && navigate(`/units/${unitId}/classes/${classItem.id}`)}
        >
          <span className="what">
            <span className="nm">{classItem.name}</span>
            <span className="mt">
              {formatDaysAndStart(classItem.rrule, classItem.startTime)} ·{' '}
              {classItem.courtName || '—'}
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  )
}

type HorariosState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; cells: AvailabilityGridReadCell[] }

function HorariosTab({ teacherId }: { teacherId: string }) {
  const [state, setState] = useState<HorariosState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getAvailability(teacherId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      // "Ocupado com aula" (busy) não tem fonte de dado real disponível
      // nesta task — ver comentário de módulo. Só available/unavailable.
      const cells: AvailabilityGridReadCell[] = result.availability.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        timeSlot: slot.timeSlot,
        status: slot.available ? 'available' : 'unavailable',
      }))
      setState({ status: 'ready', cells })
    })
    return () => {
      cancelled = true
    }
  }, [teacherId])

  if (state.status === 'loading') return <p role="status">Carregando horários…</p>
  if (state.status === 'error')
    return <p role="alert">Não foi possível carregar a disponibilidade.</p>

  return <AvailabilityGrid mode="read" cells={state.cells} />
}

type ComissaoState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; earnings: Earnings }

const MONTH_ABBREV = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function monthAbbrev(period: string): string {
  const month = Number(period.slice(5, 7))
  return MONTH_ABBREV[month - 1] ?? period
}

function ComissaoTab({
  unitId,
  teacherId,
  remunerationValue,
}: {
  unitId: string | undefined
  teacherId: string
  /** Vem do professor já carregado pela página-pai (GET /teachers/{id}) —
   * GET /teachers/{id}/earnings devolve só remuneration_model, não o value,
   * então o rótulo completo do stat "Modelo" (ex.: "Comissão 30%") precisa
   * do value de uma fonte que já o tem, evitando uma segunda chamada de
   * rede só para isso. */
  remunerationValue: number
}) {
  const navigate = useNavigate()
  const [state, setState] = useState<ComissaoState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getEarnings(teacherId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', earnings: result.earnings })
    })
    return () => {
      cancelled = true
    }
  }, [teacherId])

  if (state.status === 'loading') return <p role="status">Carregando comissão…</p>
  if (state.status === 'error') return <p role="alert">Não foi possível carregar a comissão.</p>

  const { earnings } = state
  // Só os 3 meses mais recentes (o endpoint devolve 6) — mesmo recorte do
  // protótipo real ("Comissão · últimos 3 meses").
  const lastThree = earnings.history.slice(-3)
  const maxAmount = Math.max(1, ...lastThree.map((h) => h.amount))

  return (
    <div className="ptab-panel">
      <div className="stat4">
        <Stat
          label="Modelo"
          value={formatRemunerationSummary(earnings.remunerationModel, remunerationValue)}
        />
        <Stat label="Aulas no mês" value={String(earnings.classesGivenInPeriod)} />
        <Stat
          label="Receita gerada"
          value={
            earnings.remunerationModel === 'commission'
              ? earnings.revenueGenerated !== null
                ? formatBRL(earnings.revenueGenerated)
                : '—'
              : '—'
          }
        />
        <Stat
          label="Comissão do mês"
          value={
            earnings.currentMonthAmount !== null ? formatBRL(earnings.currentMonthAmount) : '—'
          }
          highlight
        />
      </div>

      <div className="chart-wrap">
        <div className="sec-head">
          <h2>Comissão · últimos 3 meses</h2>
        </div>
        <div className="mini-bars">
          {lastThree.map((entry) => (
            <div className="mb" key={entry.period}>
              <div
                className="bar"
                style={{ height: `${Math.max(4, (entry.amount / maxAmount) * 52)}px` }}
                aria-label={`${monthAbbrev(entry.period)}: ${formatBRL(entry.amount)}`}
              />
              <span>{monthAbbrev(entry.period)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="hint">
        Comissão calculada automaticamente por cron mensal (registro em commission_records).
      </p>

      {/* PR4 — Meus Ganhos (BEAC-1700/BEAC-1884), agora registrada em
          App.tsx (TeacherEarningsPage.tsx). */}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => unitId && navigate(`/units/${unitId}/teachers/${teacherId}/earnings`)}
      >
        Ver como o professor vê (Meus Ganhos)
      </button>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="s">
      <div className="l">{label}</div>
      <div className={highlight ? 'v v--highlight' : 'v'}>{value}</div>
    </div>
  )
}

function BioTab({ bio }: { bio: string | null }) {
  return <p className="bio-text">{bio ?? 'Nenhuma bio cadastrada.'}</p>
}
