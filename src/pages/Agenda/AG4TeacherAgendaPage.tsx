import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { TeacherBlockRequestButton } from '../../components/TeacherBlockRequestButton/TeacherBlockRequestButton'
import {
  getBookingsGrid,
  listBookingParticipants,
  type Booking,
  type BookingParticipant,
  type GetBookingsGridSuccess,
} from '../../lib/api/bookings'
import { getMe } from '../../lib/api/me'
import { getSessionMemberships } from '../../lib/tenantContext'
import { SKILL_TIERS } from '../../lib/api/skillLevels'
import { dayWindow, formatWeekdayDate, isSameDay, weekWindow } from './agendaShared'
import { bookingsToTeacherAgendaClasses } from './teacherAgendaClasses'
import '../../components/AuthLayout/AuthLayout.css'
import './Agenda.css'
import './AG4TeacherAgendaPage.css'

type Tab = 'hoje' | 'semana'

// Janela de check-in duplicada do backend (rallye-api/api/internal/bookings/
// attendance_handler.go:123-126, isWithinCheckinWindow/checkinWindowBefore/
// checkinWindowAfter — funções/constantes privadas do pacote Go, não
// exportáveis sem mudar sua visibilidade). Usada SÓ para decidir o estado
// visual da linha (3 estados de AG4) — a submissão real de check-in
// continua validada e registrada pelo backend (POST .../attendance, que já
// devolve `retroactive` quando fora da janela), então uma divergência de
// relógio entre cliente/servidor no pior caso só mostra o botão certo um
// pouco cedo/tarde, nunca aceita um check-in inválido.
const CHECKIN_WINDOW_BEFORE_MS = 15 * 60 * 1000
const CHECKIN_WINDOW_AFTER_MS = 30 * 60 * 1000

function isWithinCheckinWindow(now: Date, startAtIso: string): boolean {
  const start = new Date(startAtIso).getTime()
  const n = now.getTime()
  return n >= start - CHECKIN_WINDOW_BEFORE_MS && n <= start + CHECKIN_WINDOW_AFTER_MS
}

type RowState = 'available' | 'future' | 'done'

/**
 * Estado de linha (3 estados do doc de AG4). Para aula PASSADA, fora da
 * janela, sem check-in feito — caso não coberto explicitamente pelo doc da
 * tela (que só descreve "fora da janela" para aula FUTURA) — decisão desta
 * implementação: trata como 'available' em vez de inventar um 4º estado
 * visual. O backend já aceita check-in retroativo depois da janela (mesmo
 * endpoint, devolve `retroactive: true`), então mostrar o botão aqui só
 * reflete uma capacidade que já existe, não inventa uma nova.
 */
function rowState(now: Date, booking: Booking): RowState {
  if (booking.checkedIn) return 'done'
  if (isWithinCheckinWindow(now, booking.startAt)) return 'available'
  if (now.getTime() < new Date(booking.startAt).getTime()) return 'future'
  return 'available'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function groupByArena(bookings: Booking[]): { unitId: string; unitName: string; items: Booking[] }[] {
  const groups = new Map<string, { unitName: string; items: Booking[] }>()
  for (const b of bookings) {
    const g = groups.get(b.unitId) ?? { unitName: b.unitName, items: [] }
    g.items.push(b)
    groups.set(b.unitId, g)
  }
  return Array.from(groups.entries())
    .map(([unitId, g]) => ({
      unitId,
      unitName: g.unitName,
      items: g.items.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime()),
    }))
    .sort((a, b) => a.unitName.localeCompare(b.unitName))
}

function groupByDate(bookings: Booking[]): { label: string; items: Booking[] }[] {
  const groups = new Map<string, Booking[]>()
  for (const b of bookings) {
    const key = new Date(b.startAt).toDateString()
    const list = groups.get(key) ?? []
    list.push(b)
    groups.set(key, list)
  }
  return Array.from(groups.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([key, items]) => {
      const d = new Date(key)
      const label = `${isSameDay(d, new Date()) ? 'Hoje · ' : ''}${formatWeekdayDate(d)}`
      return { label, items: items.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime()) }
    })
}

/**
 * AG4 — Minha Agenda (Professor). Buraco de planejamento do Épico 6
 * (Agendamento, já Done) — a descrição do épico cita "Telas AG4, AG5, AG7,
 * AG8, AG9 e AG10" no seu escopo, mas nenhuma story/task específica de AG4
 * chegou a ser criada. Construída por pedido direto do usuário nesta
 * sessão, sem story/task no Allye (ver relatório da sessão) — mirror direto
 * de AG3StudentAgendaPage.tsx (mesmo padrão de identidade via GET /me,
 * BottomSheet, fail-open, cancelamento de effects), adaptado para
 * professor. Doc real: "AG4 — Minha Agenda (Professor)"; protótipo real:
 * artifact "Rallye — Agenda", seção scr-ag4.
 *
 * DIFERENÇAS-CHAVE vs. AG3 (motivadas por gaps de dados descobertos durante
 * o planejamento desta sessão, todos resolvidos com o usuário antes de
 * implementar):
 *
 * - Cross-arena: busca bookings em TODAS as memberships da sessão
 *   (getSessionMemberships, ../../lib/tenantContext.ts — exportada nesta
 *   mesma sessão só pra isto) via 1 chamada de getBookingsGrid por unit,
 *   em paralelo, mescladas. Agrupa por arena (unitId/unitName, campos novos
 *   de Booking) só quando há mais de 1 arena nos resultados — professor de
 *   arena única nunca vê cabeçalho de grupo.
 * - Tabs Hoje/Semana (não Próximas/Histórico) — navegação entre dias na aba
 *   Hoje via botões ‹/› (mesmo padrão de AG1DayPage.tsx; "swipe" do doc da
 *   tela não tem nenhum precedente de gesture library neste código-fonte,
 *   então implementado como tap-driven, mesmo caminho já usado por AG1).
 * - 3 estados de linha (check-in disponível/fora da janela/feito) via
 *   `checkedIn` (novo campo de Booking, agregado no backend) + janela de
 *   15min/30min duplicada localmente (ver comentário de rowState acima).
 * - Aula particular mostra o nome do aluno no lugar da contagem de alunos.
 * - `TeacherBlockRequestButton` (BEAC-1889, já pronto/testado, não usado em
 *   lugar nenhum até esta sessão) plugado no header, convertendo os
 *   bookings já carregados via bookingsToTeacherAgendaClasses
 *   (./teacherAgendaClasses.ts).
 * - Bottom sheet "Alunos da Aula": lista via listBookingParticipants (já
 *   existia), com tag de nível REAL (SkillTier de 6 valores, SKILL_TIERS de
 *   ../../lib/api/skillLevels.ts) — decisão explícita desta sessão de NÃO
 *   inventar um agrupamento de 3 buckets (INIC./INTER./AVANÇ.) sugerido
 *   pelo texto do doc mas que não existe em nenhum lugar do schema real.
 *
 * GAPS OMITIDOS (mesmo espírito do gap "Histórico" de AG3StudentAgendaPage):
 * sistema de feedback (badge ⚠️ de aula com feedback pendente, botão "Dar
 * feedback" no bottom sheet) não existe em NENHUM lugar do backend
 * (confirmado por grep nesta sessão) — omitido inteiramente, sem stub.
 * Avatar de aluno: omitido, sem coluna em nenhuma tabela do schema. Barra
 * colorida por esporte ("sport stripe"): omitida a cor (só a barra
 * decorativa), mesma simplificação já presente em AG3 — Booking não carrega
 * court.sport, colori-la exigiria uma busca adicional de courts por unit,
 * fora do escopo aprovado desta sessão.
 *
 * Rota (`/units/:unitId/agenda/professor`, App.tsx) carrega `:unitId` só
 * pela convenção de URL das demais telas de agenda — o componente em si
 * ignora esse param (nunca chama useParams): a busca é cross-arena via
 * getSessionMemberships, não escopada à unit da URL.
 */
export default function AG4TeacherAgendaPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('hoje')
  const [date, setDate] = useState(new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [teacherId, setTeacherId] = useState<string | undefined>(undefined)
  const [identityResolved, setIdentityResolved] = useState(false)

  const [participantsBooking, setParticipantsBooking] = useState<Booking | null>(null)
  const [participants, setParticipants] = useState<BookingParticipant[]>([])
  const [participantsError, setParticipantsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMe().then((result) => {
      if (cancelled) return
      if (result.ok) setTeacherId(result.id)
      // Falha (ex.: 403 de sessão temporary): segue sem teacher_id — mesmo
      // fail-open de AG3StudentAgendaPage (loggedInStudentId). Não bloqueia
      // a tela; só deixa de escopar por professor.
      setIdentityResolved(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!identityResolved) return
    let cancelled = false
    const memberships = getSessionMemberships()
    if (memberships.length === 0) {
      // react-hooks/set-state-in-effect: setState precisa ficar num callback
      // assíncrono, nunca síncrono no corpo do efeito — mesmo sem nada
      // async pra esperar aqui, adiamos via microtask pra satisfazer a regra
      // (respeita `cancelled` igual ao branch async abaixo).
      Promise.resolve().then(() => {
        if (cancelled) return
        setBookings([])
        setLoadError(null)
      })
      return
    }
    const { from, to } = tab === 'hoje' ? dayWindow(date) : weekWindow(date)

    Promise.all(memberships.map((m) => getBookingsGrid(m.unit_id, from, to, undefined, undefined, teacherId))).then(
      (results) => {
        if (cancelled) return
        const failures = results.filter((r) => !r.ok)
        if (failures.length === results.length) {
          setLoadError('Não foi possível carregar sua agenda.')
          return
        }
        setLoadError(null)
        const merged = results
          .filter((r): r is GetBookingsGridSuccess => r.ok)
          .flatMap((r) => r.bookings)
          .filter((b) => b.status === 'confirmed' && b.type !== 'block' && b.type !== 'rental')
        setBookings(merged)
      },
    )
    return () => {
      cancelled = true
    }
  }, [identityResolved, teacherId, tab, date])

  useEffect(() => {
    if (!participantsBooking) return
    let cancelled = false
    // react-hooks/set-state-in-effect: mesmo motivo do efeito acima — o
    // reset do erro anterior precisa ficar num callback assíncrono, não
    // síncrono no corpo do efeito.
    Promise.resolve().then(() => {
      if (cancelled) return
      setParticipantsError(null)
    })
    listBookingParticipants(participantsBooking.id).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setParticipantsError('Não foi possível carregar a lista de alunos.')
        return
      }
      setParticipants(result.participants)
    })
    return () => {
      cancelled = true
    }
  }, [participantsBooking])

  const arenaGroups = useMemo(() => groupByArena(bookings), [bookings])
  const dateGroups = useMemo(() => groupByDate(bookings), [bookings])
  const teacherClasses = useMemo(() => bookingsToTeacherAgendaClasses(bookings), [bookings])
  const showArenaHeaders = arenaGroups.length > 1

  function changeDay(delta: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + delta)
    setDate(next)
  }

  function renderRow(booking: Booking) {
    const now = new Date()
    const state = rowState(now, booking)
    const isPrivate = booking.type === 'private'

    return (
      <div className="ag-row ag4-row" key={booking.id}>
        <span className="when">{formatTime(booking.startAt)}</span>
        <span className="strip" />
        <div className="what">
          <div className="nm">{booking.className ?? 'Aula particular'}</div>
          <div className="mt">
            {booking.courtName} ·{' '}
            {isPrivate ? (booking.studentName ?? '—') : `${booking.studentCount} ${booking.studentCount === 1 ? 'aluno' : 'alunos'}`}
          </div>
        </div>
        <div className="tail ag4-actions">
          {state === 'available' ? (
            <>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() =>
                  navigate(`/units/${booking.unitId}/bookings/${booking.id}/checkin`, { state: { booking } })
                }
              >
                Check-in
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setParticipants([])
                  setParticipantsError(null)
                  setParticipantsBooking(booking)
                }}
              >
                Alunos
              </button>
            </>
          ) : null}
          {state === 'future' ? <span className="hint ag4-future-hint">Disponível às {formatTime(booking.startAt)}</span> : null}
          {state === 'done' ? <span className="badge b-success">✅ Check-in feito</span> : null}
        </div>
      </div>
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="ag-head">
        <h1>Minha agenda</h1>
        <div className="spacer" />
        {/* Gate na identidade resolvida (não fail-open) — TeacherBlockRequestButton
            é um caminho de ESCRITA (cria solicitação em nome do professor),
            diferente da leitura de bookings acima; mesmo princípio de AG3
            (RemarcarSheet só é montado com studentId resolvido). */}
        {teacherId ? <TeacherBlockRequestButton teacherId={teacherId} classes={teacherClasses} /> : null}
        <div className="seg2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'hoje'}
            className={tab === 'hoje' ? 'active' : ''}
            onClick={() => setTab('hoje')}
          >
            Hoje
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'semana'}
            className={tab === 'semana' ? 'active' : ''}
            onClick={() => setTab('semana')}
          >
            Semana
          </button>
        </div>
      </div>

      {loadError ? <p role="alert">{loadError}</p> : null}

      {tab === 'hoje' ? (
        <div className="dash-body">
          <div className="date-nav">
            <button className="iconbtn" aria-label="Dia anterior" onClick={() => changeDay(-1)}>
              ‹
            </button>
            <span className="dlabel">{`${isSameDay(date, new Date()) ? 'Hoje · ' : ''}${formatWeekdayDate(date)}`}</span>
            <button className="iconbtn" aria-label="Próximo dia" onClick={() => changeDay(1)}>
              ›
            </button>
          </div>

          {bookings.length === 0 ? <p className="hint">Dia livre! Nenhuma aula agendada.</p> : null}

          {showArenaHeaders
            ? arenaGroups.map((group) => (
                <div key={group.unitId}>
                  <div className="dgroup ag4-arena-header">{group.unitName}</div>
                  <div className="ag-list">{group.items.map(renderRow)}</div>
                </div>
              ))
            : (
                <div className="ag-list">
                  {arenaGroups.flatMap((g) => g.items).map(renderRow)}
                </div>
              )}
        </div>
      ) : (
        <div className="dash-body">
          {dateGroups.length === 0 ? <p className="hint">Nenhuma aula agendada esta semana.</p> : null}
          {dateGroups.map((group) => (
            <div key={group.label}>
              <div className="dgroup">{group.label}</div>
              <div className="ag-list">{group.items.map(renderRow)}</div>
            </div>
          ))}
        </div>
      )}

      <BottomSheet
        open={participantsBooking !== null}
        onClose={() => setParticipantsBooking(null)}
        label="Alunos da Aula"
      >
        {participantsBooking ? (
          <div className="ag4-participants-sheet">
            <h2>
              {participantsBooking.className ?? 'Aula particular'} · {participants.length}{' '}
              {participants.length === 1 ? 'aluno' : 'alunos'}
            </h2>
            {participantsError ? <p role="alert">{participantsError}</p> : null}
            <ul className="ag4-participants-list">
              {participants.map((p) => {
                const tierLabel = SKILL_TIERS.find((t) => t.value === p.tier)?.label ?? null
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="ag4-participant-row"
                      onClick={() => navigate(`/units/${participantsBooking.unitId}/students/${p.studentId}`)}
                    >
                      <span className="ag4-participant-name">{p.studentName ?? 'Aluno'}</span>
                      {tierLabel ? <span className="badge b-neutral">{tierLabel}</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
            {/* Botão "Dar feedback": omitido — sistema de feedback não existe
                em nenhum lugar do backend (grep confirmado nesta sessão),
                mesmo gap já documentado no comentário de pacote acima. */}
          </div>
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}
