import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { usePermission } from '../../hooks/usePermission'
import { listClasses, type RallyeClass } from '../../lib/api/classes'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { sportCssVar, sportLabel } from '../../lib/sports'
import { ClassSettingsSheet } from './ClassSettingsSheet'
import { formatDaysAndRange, levelLabel, occupancyOf } from './turmasShared'
import '../../components/AuthLayout/AuthLayout.css'
import './TurmaDetailPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; classItem: RallyeClass }

type Tab = 'alunos' | 'proximas' | 'presenca' | 'waitlist'

/**
 * T2 — Detalhe da turma (BEAC-1901, story BEAC-1704). Markup/copy lidos
 * diretamente do protótipo real (mesmo Artifact de T1, seção `scr-t2`,
 * linhas ~626-700 do arquivo salvo): `.prof-head` (h1 nome + `.badge
 * b-sport` esporte·nível + `.mt` professor/quadra/dias·horário·ocupação),
 * `.ptabs` com 4 abas (Alunos/Próximas/Presença/Waitlist), `.iconbtn` [⚙️]
 * só para quem tem `agenda:write`.
 *
 * ## Sem GET /classes/{id} — reaproveita a listagem
 *
 * Não existe (e não foi adicionado) um endpoint de LEITURA de uma turma
 * única — só listagem (GET /units/{id}/classes, adicionado para T1) e
 * create/patch/delete. Em vez de propor mais um endpoint nesta dispatch,
 * esta página busca a lista inteira da unit e localiza a turma por id
 * client-side (decisão desta task: mais simples que pedir uma mudança de
 * contrato de backend só para "1 registro de uma lista que já existe";
 * reavaliar se a lista crescer o bastante para isso pesar).
 *
 * ## Abas Alunos/Presença/Waitlist — bloqueadas, não fabricadas
 *
 * `public.class_enrollments` e `public.waitlist_entries` NÃO existem no
 * backend (gaps conhecidos, documentados no comentário de pacote de
 * ../../lib/api/classes.ts e no handover de execução desta story) e não há
 * tabela de presença/check-in (mesmo gap de BEAC-1906). As 3 abas
 * correspondentes mostram um estado vazio EXPLICITAMENTE marcado como
 * pendente ("Nenhum dado disponível — endpoint pendente"), nunca dado
 * inventado. Pelo mesmo motivo, "turma lotada" (que trocaria "+ Adicionar
 * aluno" por "Turma lotada" desabilitado) nunca pode ser avaliado com dado
 * real — ver AC bullet correspondente marcado como bloqueado no relatório
 * desta task.
 *
 * ## Aba "Próximas" — real
 *
 * Usa GET /units/{id}/bookings (getBookingsGrid, ../../lib/api/bookings.ts)
 * numa janela de hoje até +60 dias, filtrando client-side por `classId`
 * (decisão desta task: o endpoint só filtra por court_id/from/to, não por
 * class_id — pedir essa extensão de contrato só para esta aba não parecia
 * valer a pena frente a filtrar ~poucas dezenas de linhas no cliente;
 * reavaliar se o volume de bookings por unit crescer o bastante para isso
 * pesar). Mostra as 5 próximas ocorrências; toque navega para
 * `/units/{id}/bookings/{bookingId}` (AG5 — BEAC-1905, mesma story,
 * encontrada já implementada durante esta dispatch) passando o Booking já
 * carregado via router state, mesmo padrão de AG1DayPage/AG2WeekPage (ver
 * AG5BookingDetailPage.tsx: não há GET /bookings/{id} para deep link direto,
 * então a página de destino espera `location.state.booking`).
 */
export default function TurmaDetailPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, classId } = useParams<{ unitId: string; classId: string }>()
  const navigate = useNavigate()
  const canManage = usePermission('agenda', 'write')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('alunos')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addStudentInfoOpen, setAddStudentInfoOpen] = useState(false)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request = unitId ? listClasses(unitId) : Promise.reject(new Error('missing_unit_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          const found = result.classes.find((c) => c.id === classId)
          setState(found ? { status: 'ready', classItem: found } : { status: 'not-found' })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, classId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const classItem = state.status === 'ready' ? state.classItem : null

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to={unitId ? `/units/${unitId}/classes` : '/perfil'}>
          ‹ Turmas
        </Link>
        <div className="spacer" />
        {canManage && classItem ? (
          <button
            type="button"
            className="iconbtn"
            aria-label="Configurações da turma"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙️
          </button>
        ) : null}
      </div>

      {state.status === 'loading' ? <p role="status">Carregando turma…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar esta turma.</p>
      ) : null}
      {state.status === 'not-found' ? <p role="alert">Turma não encontrada.</p> : null}

      {classItem ? (
        <>
          <ClassHeader classItem={classItem} />

          <div className="ptabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'alunos'}
              className={tab === 'alunos' ? 'active' : ''}
              onClick={() => setTab('alunos')}
            >
              Alunos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'proximas'}
              className={tab === 'proximas' ? 'active' : ''}
              onClick={() => setTab('proximas')}
            >
              Próximas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'presenca'}
              className={tab === 'presenca' ? 'active' : ''}
              onClick={() => setTab('presenca')}
            >
              Presença
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'waitlist'}
              className={tab === 'waitlist' ? 'active' : ''}
              onClick={() => setTab('waitlist')}
            >
              Waitlist
            </button>
          </div>

          <div className="dash-body">
            {tab === 'alunos' ? (
              <AlunosTabPlaceholder canManage={canManage} onAdd={() => setAddStudentInfoOpen(true)} />
            ) : null}
            {tab === 'proximas' ? <ProximasTab unitId={unitId} classId={classItem.id} /> : null}
            {tab === 'presenca' ? <PresencaTabPlaceholder /> : null}
            {tab === 'waitlist' ? <WaitlistTabPlaceholder /> : null}
          </div>
        </>
      ) : null}

      <BottomSheet
        open={settingsOpen && classItem !== null}
        onClose={() => setSettingsOpen(false)}
        label="Configurações da turma"
      >
        {classItem && unitId ? (
          <ClassSettingsSheet
            unitId={unitId}
            classItem={classItem}
            onUpdated={(updated) => {
              setState({ status: 'ready', classItem: updated })
              setSettingsOpen(false)
            }}
            onDeactivated={() => {
              setSettingsOpen(false)
              if (unitId) navigate(`/units/${unitId}/classes`)
            }}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={addStudentInfoOpen}
        onClose={() => setAddStudentInfoOpen(false)}
        label="Adicionar aluno"
      >
        <div className="ptab-panel">
          <h2 className="sec-head-title">Adicionar aluno</h2>
          <p className="hint">
            Indisponível nesta versão: não existe <code>public.class_enrollments</code> (quem está
            matriculado numa turma) nem um endpoint de busca de alunos da unit no backend — ambos
            gaps conhecidos, fora do escopo desta task (não é uma decisão de modelagem de dados que
            esta dispatch deveria adivinhar).
          </p>
        </div>
      </BottomSheet>
    </AppShell>
  )
}

function ClassHeader({ classItem }: { classItem: RallyeClass }) {
  const occ = occupancyOf(classItem)
  const level = levelLabel(classItem.level)
  return (
    <div className="prof-head" style={{ paddingTop: 0 }}>
      <div className="ph-main">
        <h1>
          {classItem.name}{' '}
          <span className="badge b-sport">
            <span className="sdot" style={{ background: `var(${sportCssVar(classItem.sport)})` }} />{' '}
            {sportLabel(classItem.sport)}
            {level ? ` · ${level}` : ''}
          </span>
        </h1>
        <div className="mt">
          {classItem.teacherName ? `Prof. ${classItem.teacherName}` : 'Sem professor'} ·{' '}
          {classItem.courtName || '—'} ·{' '}
          {formatDaysAndRange(classItem.rrule, classItem.startTime, classItem.endTime)} · —/
          {occ.capacity} alunos
        </div>
      </div>
    </div>
  )
}

function AlunosTabPlaceholder({ canManage, onAdd }: { canManage: boolean; onAdd: () => void }) {
  return (
    <div className="ptab-panel">
      <p className="hint" role="status">
        Nenhum dado disponível — endpoint pendente (<code>public.class_enrollments</code> não existe
        no backend).
      </p>
      {canManage ? (
        <button type="button" className="btn btn-ghost btn-md" onClick={onAdd}>
          + Adicionar aluno
        </button>
      ) : null}
    </div>
  )
}

function PresencaTabPlaceholder() {
  return (
    <div className="ptab-panel">
      <p className="hint" role="status">
        Nenhum dado disponível — endpoint pendente (sem tabela de presença/check-in no backend, mesmo
        gap de BEAC-1906).
      </p>
    </div>
  )
}

function WaitlistTabPlaceholder() {
  return (
    <div className="ptab-panel">
      <p className="hint" role="status">
        Nenhum dado disponível — endpoint pendente (<code>public.waitlist_entries</code> não existe no
        backend).
      </p>
    </div>
  )
}

type ProximasState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; bookings: Booking[] }

const PROXIMAS_WINDOW_DAYS = 60
const PROXIMAS_LIMIT = 5

function ProximasTab({
  unitId,
  classId,
}: {
  unitId: string | undefined
  classId: string
}) {
  const navigate = useNavigate()
  const [state, setState] = useState<ProximasState>({ status: 'loading' })

  useEffect(() => {
    if (!unitId) return
    let cancelled = false
    const from = new Date()
    const to = new Date(from.getTime() + PROXIMAS_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    getBookingsGrid(unitId, from.toISOString(), to.toISOString()).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      const upcoming = result.bookings
        .filter((b) => b.classId === classId && b.status === 'confirmed')
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .slice(0, PROXIMAS_LIMIT)
      setState({ status: 'ready', bookings: upcoming })
    })
    return () => {
      cancelled = true
    }
  }, [unitId, classId])

  if (state.status === 'loading') return <p role="status">Carregando próximas aulas…</p>
  if (state.status === 'error') {
    return <p role="alert">Não foi possível carregar as próximas aulas.</p>
  }
  if (state.bookings.length === 0) {
    return <p className="hint">Nenhuma ocorrência futura encontrada.</p>
  }

  return (
    <div className="ag-list">
      {state.bookings.map((booking) => (
        <button
          type="button"
          key={booking.id}
          className="ag-row"
          onClick={() =>
            unitId && navigate(`/units/${unitId}/bookings/${booking.id}`, { state: { booking } })
          }
        >
          <span className="when">{formatTime(booking.startAt)}</span>
          <span className="what">
            <span className="nm">{formatOccurrenceDate(booking.startAt)}</span>
            <span className="mt">{booking.courtName}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTH = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function formatOccurrenceDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const dateLabel = `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`
  return isToday ? `Hoje · ${dateLabel}` : dateLabel
}
