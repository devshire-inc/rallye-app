import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { SportTag } from '../../components/ui/SportTag/SportTag'
import { StatCard } from '../../components/ui/StatCard/StatCard'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { usePermission } from '../../hooks/usePermission'
import { listClasses, type RallyeClass } from '../../lib/api/classes'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { getWaitlistStatus } from '../../lib/api/waitlist'
import { sportLabel } from '../../lib/sports'
import { ClassSettingsSheet } from './ClassSettingsSheet'
import { formatDaysAndRange, levelLabel, occupancyOf } from './turmasShared'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './TurmaDetailPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; classItem: RallyeClass }

type Tab = 'alunos' | 'proximas' | 'presenca' | 'waitlist'

/** `ui/Tabs` é indexado por rótulo (o rótulo É o valor); esta tela modela as
 * abas por chave, então a ida e volta chave<->rótulo mora aqui — mesmo par
 * TAB_ORDER/TAB_LABELS de TournamentViewPage.tsx. */
const TAB_ORDER: Tab[] = ['alunos', 'proximas', 'presenca', 'waitlist']
const TAB_LABELS: Record<Tab, string> = {
  alunos: 'Alunos',
  proximas: 'Próximas',
  presenca: 'Presença',
  waitlist: 'Waitlist',
}

/**
 * T2 — Detalhe da turma (BEAC-1901, story BEAC-1704). Markup/copy lidos
 * diretamente do protótipo real (mesmo Artifact de T1, seção `scr-t2`,
 * linhas ~626-700 do arquivo salvo): `.prof-head` (h1 nome + esporte·nível
 * + `.mt` professor/quadra/dias·horário·ocupação), 4 abas
 * (Alunos/Próximas/Presença/Waitlist — hoje o `ui/Tabs` do DS, antes um
 * `.ptabs` local), botão [⚙️] só para quem tem
 * `agenda:write`. Esporte·nível e o botão de configurações migrados para os
 * componentes ui/SportTag e ui/IconButton (BEAC-2105, restyle Claude
 * Design).
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
 * ## Abas Alunos/Presença — bloqueadas, não fabricadas (mas os MECANISMOS existem)
 *
 * As tabelas/mecanismos por trás destas 2 abas EXISTEM — o que falta é uma
 * LISTAGEM/AGREGAÇÃO por turma, não o dado em si (mesma classe de erro que
 * levou à correção de escopo da aba Waitlist abaixo, mas com um veredito
 * diferente: aqui falta mesmo um endpoint novo, então o placeholder
 * continua correto, só o texto que o justifica que precisava de correção):
 *   - Alunos: `public.class_enrollments` EXISTE (migration 000036), com
 *     `POST /classes/{id}/enrollments` real (BEAC-1862). Falta um `GET
 *     /classes/{id}/enrollments` (ou busca de alunos da unit) para listar
 *     quem já está matriculado.
 *   - Presença: BEAC-1906 construiu `POST /bookings/{id}/attendance` + `GET
 *     /bookings/{id}/participants`, gravando em `public.booking_participants`
 *     (migration 000037) — presença POR RESERVA já existe. Falta uma
 *     AGREGAÇÃO por turma (juntar a presença de todas as reservas de uma
 *     turma), não o mecanismo de presença em si.
 * Construir esses endpoints de listagem/agregação é trabalho de feature
 * nova, fora do escopo desta dispatch — as 2 abas correspondentes mostram
 * um estado vazio EXPLICITAMENTE marcado como pendente ("Nenhum dado
 * disponível — endpoint pendente"), nunca dado inventado. Pelo mesmo
 * motivo, "turma lotada" (que trocaria "+ Adicionar aluno" por "Turma
 * lotada" desabilitado) nunca pode ser avaliado com dado real — ver AC
 * bullet correspondente marcado como bloqueado no relatório desta task.
 *
 * ## Aba "Waitlist" — real (correção de escopo, ampliação da story)
 *
 * Ao contrário do que um comentário desatualizado desta mesma base sugeria,
 * `public.waitlist_entries` EXISTE (migration 000041) e os 3 endpoints
 * (POST/DELETE/GET `/classes/{id}/waitlist`) já estão em produção, usados
 * por WaitlistSheet.tsx/OfferSheet.tsx (Agenda, BEAC-1708/1922/1923). Esta
 * aba consome o mesmo `getWaitlistStatus` (../../lib/api/waitlist.ts) só
 * para leitura: ocupação atual/capacidade, tamanho da fila e a posição do
 * próprio chamador na fila (só quando não-nula) — nunca entra/sai da fila
 * por aqui (isso é ação do aluno, já coberto por WaitlistSheet).
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
          <IconButton
            variant="ghost"
            label="Configurações da turma"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙️
          </IconButton>
        ) : null}
      </div>

      {state.status === 'loading' ? <PageLoading label="Carregando turma" variant="section" /> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar esta turma.</p>
      ) : null}
      {state.status === 'not-found' ? <p role="alert">Turma não encontrada.</p> : null}

      {classItem ? (
        <>
          <ClassHeader classItem={classItem} />

          <div className="t2-tabs">
            <Tabs
              tabs={TAB_ORDER.map((key) => TAB_LABELS[key])}
              value={TAB_LABELS[tab]}
              onChange={(label) => {
                const next = TAB_ORDER.find((key) => TAB_LABELS[key] === label)
                if (next) setTab(next)
              }}
              ariaLabel="Seções da turma"
            />
          </div>

          <div className="dash-body">
            {tab === 'alunos' ? (
              <AlunosTabPlaceholder canManage={canManage} onAdd={() => setAddStudentInfoOpen(true)} />
            ) : null}
            {tab === 'proximas' ? <ProximasTab unitId={unitId} classId={classItem.id} /> : null}
            {tab === 'presenca' ? <PresencaTabPlaceholder /> : null}
            {tab === 'waitlist' ? <WaitlistTab classId={classItem.id} /> : null}
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
            Indisponível nesta versão: não existe um <code>GET /classes/{'{id}'}/enrollments</code>
            para listar quem já está matriculado, nem um endpoint de busca de alunos da unit no
            backend — ambos gaps conhecidos, fora do escopo desta task (não é uma decisão de
            modelagem de dados que esta dispatch deveria adivinhar).
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
          <SportTag sport={classItem.sport}>
            {`${sportLabel(classItem.sport)}${level ? ` · ${level}` : ''}`}
          </SportTag>
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
        Nenhum dado disponível — endpoint pendente (sem <code>GET /classes/{'{id}'}/enrollments</code>
        para listar quem já está matriculado).
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
        Nenhum dado disponível — endpoint pendente (sem uma agregação de presença por turma, só por
        reserva).
      </p>
    </div>
  )
}

type WaitlistTabState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      activeEnrollments: number
      capacity: number
      queueSize: number
      yourPosition: number | null
    }

function WaitlistTab({ classId }: { classId: string }) {
  const [state, setState] = useState<WaitlistTabState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getWaitlistStatus(classId)
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setState({ status: 'error' })
          return
        }
        setState({
          status: 'ready',
          activeEnrollments: result.activeEnrollments,
          capacity: result.capacity,
          queueSize: result.queueSize,
          yourPosition: result.yourPosition,
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [classId])

  if (state.status === 'loading') return <PageLoading label="Carregando fila de espera" variant="list" rows={3} />
  if (state.status === 'error') {
    return <p role="alert">Não foi possível carregar a fila de espera desta turma.</p>
  }

  return (
    <div className="waitlist-stats">
      <StatCard label="Ocupação" value={`${state.activeEnrollments}/${state.capacity}`} />
      <StatCard label="Fila de espera" value={String(state.queueSize)} />
      {state.yourPosition !== null ? (
        <StatCard label="Sua posição" value={`#${state.yourPosition}`} />
      ) : null}
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

  if (state.status === 'loading') return <PageLoading label="Carregando próximas aulas" variant="list" rows={3} />
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
