import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgendaMobile, type AgendaMobileEvent } from '../../components/AgendaMobile/AgendaMobile'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { TeacherBlockRequestButton } from '../../components/TeacherBlockRequestButton/TeacherBlockRequestButton'
import {
  getBookingsGrid,
  listBookingParticipants,
  type Booking,
  type BookingParticipant,
  type GetBookingsGridSuccess,
} from '../../lib/api/bookings'
import { useMe } from '../../hooks/useMe'
import { getSessionMemberships } from '../../lib/tenantContext'
import { SKILL_TIERS } from '../../lib/api/skillLevels'
import { groupByArenaLabel } from '../../lib/agenda/groupByArena'
import { rowState } from '../../lib/agenda/checkinWindow'
import {
  bookingSubtitle,
  bookingTitle,
  bookingTone,
  dayWindow,
  formatHM,
  formatISODate,
  formatShortRange,
  formatWeekdayDate,
  GRID_END_HOUR,
  GRID_START_HOUR,
  isSameDay,
  weekDaysSunday,
  weekWindow,
} from './agendaShared'
import { bookingsToTeacherAgendaClasses } from './teacherAgendaClasses'
// `.btn/.btn-ghost/.btn-sm` do TeacherBlockRequestButton moram aqui e o
// componente não importa a folha; sem este import a tela abriria com o botão
// sem estilo quando AG4 é a primeira rota carregada (em produção o bundle é
// um CSS só e a falta não apareceria — é um defeito só de dev, o mesmo tipo
// que o `mountedRef` de AG2).
import '../../components/AuthLayout/AuthLayout.css'
import './AG4TeacherAgendaPage.css'

type Tab = 'Hoje' | 'Semana'

const TABS: Tab[] = ['Hoje', 'Semana']

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Agrupamento por DIA, usado só pela aba Semana (a de Hoje é uma timeline
 * de um dia só). */
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
      return {
        label,
        items: items.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime()),
      }
    })
}

/**
 * AG4 — Minha Agenda (Professor), frames "Agenda — Professor — Mobile"
 * (35:1096), "… Mobile (Dark)" (186:4455) e "… Desktop" (99:1584) do
 * protótipo hb7PA0Xx3L7iHjt9AfHsGK. Segunda tela do reskin de Agenda &
 * Check-in, depois de AG1DayPage (0abc631).
 *
 * A tela deixou de desenhar markup próprio de lista: ela COMPÕE
 * `AgendaMobile` — o mesmo pattern que AG1 usa no mobile — pelos mesmos
 * motivos daquele reskin (componente feito do protótipo e tela feita à mão
 * divergindo é o defeito que já custou caro em MatchCard/Medal).
 *
 * POR QUE SÓ `AgendaMobile`, SEM `AgendaDesktop`: o frame desktop do
 * professor (99:1584) NÃO é a grade hora × quadra de AgendaDesktop — é
 * literalmente a mesma timeline única do mobile, esticada, com os chips de
 * filtro acima. AgendaDesktop existe para a agenda multi-quadra do admin, e
 * usá-la aqui contrariaria o frame. AgendaMobile.css já previa isso: seu
 * bloco @media(min-width:860px) foi escrito em 0abc631 citando o frame
 * 99:1584. Consequência: nada nesta tela toca AgendaDesktop, então AG1 no
 * desktop está fora de alcance por construção.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESVIO DELIBERADO DO FRAME — a ação de check-in dentro do bloco
 * ─────────────────────────────────────────────────────────────────────────
 * Os frames desenham blocos de timeline SEM botão nenhum. Esta tela mostra
 * um botão "Check-in" DENTRO do bloco enquanto a aula está na janela de
 * check-in (15min antes / 30min depois, lib/agenda/checkinWindow.ts), e um
 * bloco limpo fora dela. Decisão de produto do dono, não interpretação
 * desta implementação: check-in não é consulta, é o trabalho acontecendo —
 * o professor está na quadra, com a turma esperando, e a ação tem janela de
 * tempo. Enterrá-la um toque abaixo seria regressão de uso real; as demais
 * informações (lista de alunos) podem custar esse toque.
 *
 * A variação NÃO existe no Figma e será sincronizada depois. Para não
 * inventar estética, o bloco com ação usa só vocabulário do design system:
 * `ui/Button` primary/sm para a ação e `ui/Badge` success para o selo
 * "✅ Check-in feito" — nenhuma cor, raio ou tipografia nova. O suporte no
 * pattern entrou como props opcionais de evento (`action`/`badge`, ver
 * AgendaMobile.tsx); AG1 não passa nenhuma delas e não muda de aparência.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CROSS-ARENA NUMA TIMELINE DE UM DIA
 * ─────────────────────────────────────────────────────────────────────────
 * AG4 busca em TODAS as memberships da sessão (getSessionMemberships), ao
 * contrário de AG1, que é escopada à unit da URL. Duas arenas podem ter aula
 * no mesmo horário, e uma timeline tem um eixo de tempo só.
 *
 * A escolha: UMA timeline, todas as arenas juntas. Não uma timeline por
 * arena. O eixo de tempo responde "onde eu preciso estar, e quando" — quebrar
 * em N seções obriga o professor a mesclar N eixos de cabeça para saber a
 * ordem do próprio dia, que é justamente o que a timeline existia para
 * resolver. Agrupar por arena é o que uma LISTA faz bem, e é o que a aba
 * Semana continua fazendo (por dia) com groupByArenaLabel disponível.
 *
 * As três consequências, resolvidas:
 * 1. Identidade da arena vai para dentro do bloco, no subtítulo
 *    ("Arena Praia Sul · Quadra 1 · 6 alunos") e SÓ quando há mais de uma
 *    arena no período — professor de arena única vê exatamente o frame.
 * 2. Colisão de horário: dois blocos às 7h passam a dividir a faixa em
 *    colunas (`overlapLanes`), em vez de um cobrir o outro. Duas aulas no
 *    mesmo horário em arenas diferentes é um conflito REAL de agenda —
 *    precisa ficar visível, não ser escondido por um empilhamento.
 * 3. A filterRow dos frames muda de eixo: com mais de uma arena os chips
 *    filtram ARENA (é o recorte que significa algo para quem dá aula em dois
 *    lugares); com uma só, filtram QUADRA, como o frame desktop desenha.
 *    Lista vazia = nenhum filtro, mesma convenção de AG1.
 *
 * Efeito colateral verificado (627873d): a arena ativa viaja no header
 * `X-Rallye-Unit` resolvido da URL, então buscar cross-arena produz
 * requisições com path de uma arena e header de outra. Continua respondendo
 * 200 (o endpoint resolve pela path) — ver o relatório da tela.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O que veio de antes e continua aqui: abas Hoje/Semana (agora o
 * `viewOptions`/`view`/`onViewChange` do próprio pattern, ligado em
 * 0abc631, com a aba Semana entrando pelo `children` de AgendaMobile porque
 * uma semana é lista, não timeline de um dia); sheet "Alunos da Aula" via
 * listBookingParticipants, agora aberto tocando o bloco; e o
 * `TeacherBlockRequestButton` (BEAC-1889) no slot de ação do pattern —
 * rodapé no mobile, canto superior direito no desktop, como os frames.
 *
 * GAPS mantidos de antes (nenhum endpoint inventado): sistema de feedback
 * não existe no backend; avatar de aluno não tem coluna em nenhuma tabela;
 * cor por esporte no bloco exigiria buscar `courts` por unit (o bloco é
 * colorido por STATUS, como em AG1 e como o frame desktop mostra).
 *
 * Rota `/units/:unitId/agenda/professor` (App.tsx) carrega `:unitId` só pela
 * convenção de URL das demais telas de agenda — o componente ignora esse
 * param: a busca é cross-arena, não escopada à unit da URL.
 */
export default function AG4TeacherAgendaPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('Hoje')
  const [date, setDate] = useState(new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string[]>([])
  // "Agora" ao vivo: a janela de check-in abre sozinha com a passagem do
  // tempo, e o botão do bloco precisa aparecer sem o professor recarregar a
  // tela. 60s é granularidade suficiente para uma janela de 15/30min (mesmo
  // timer da linha do "agora" de AG1DayPage).
  const [now, setNow] = useState(new Date())

  // teacherId do cache COMPARTILHADO de GET /me (hooks/useMe.ts) em vez de
  // um fetch próprio desta tela. `settled` é o antigo `identityResolved`:
  // true depois de sucesso OU falha. Falha (ex.: 403 de sessão temporary)
  // segue sem teacher_id — mesmo fail-open de AG3StudentAgendaPage. Não
  // bloqueia a tela; só deixa de escopar por professor.
  const { me, settled: identityResolved } = useMe()
  const teacherId = me?.id

  const [participantsBooking, setParticipantsBooking] = useState<Booking | null>(null)
  const [participants, setParticipants] = useState<BookingParticipant[]>([])
  const [participantsError, setParticipantsError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Guarda contra setState depois de desmontar. `mountedRef.current = true`
  // no CORPO do efeito, não só no valor inicial do ref: em dev o StrictMode
  // monta -> desmonta -> monta a MESMA instância, e a limpeza da primeira
  // passagem deixaria o ref em `false` para sempre — todo fetch subsequente
  // descartado e a agenda permanentemente vazia (o defeito ainda aberto em
  // AG2WeekPage.tsx:70, corrigido em AG1 em 0abc631).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const reloadBookings = useCallback(() => {
    if (!identityResolved) return
    const memberships = getSessionMemberships()
    if (memberships.length === 0) {
      // react-hooks/set-state-in-effect: setState precisa ficar num callback
      // assíncrono, nunca síncrono no corpo do efeito — mesmo sem nada async
      // pra esperar aqui, adiamos via microtask pra satisfazer a regra.
      Promise.resolve().then(() => {
        if (!mountedRef.current) return
        setBookings([])
        setLoadError(null)
      })
      return
    }
    const { from, to } = tab === 'Hoje' ? dayWindow(date) : weekWindow(date)

    Promise.all(
      memberships.map((m) => getBookingsGrid(m.unit_id, from, to, undefined, undefined, teacherId)),
    )
      .then((results) => {
        if (!mountedRef.current) return
        const failures = results.filter((r) => !r.ok)
        if (failures.length === results.length) {
          setLoadError('Não foi possível carregar sua agenda.')
          return
        }
        // Falha PARCIAL (uma arena respondeu, outra não) não pode ser
        // silenciosa: a timeline mostraria um dia incompleto e o professor
        // não teria como saber que falta aula. É exatamente o desfecho que a
        // busca cross-arena tornaria possível se o backend passasse a exigir
        // `X-Rallye-Unit` == unit do path (hoje ele resolve pela path e
        // responde 200 — ver o comentário de pacote).
        setLoadError(
          failures.length > 0
            ? `Uma das suas arenas não respondeu (${failures.length} de ${results.length}) — esta agenda pode estar incompleta.`
            : null,
        )
        const merged = results
          .filter((r): r is GetBookingsGridSuccess => r.ok)
          .flatMap((r) => r.bookings)
          .filter((b) => b.status === 'confirmed' && b.type !== 'block' && b.type !== 'rental')
        setBookings(merged)
      })
      .catch(() => {
        // getBookingsGrid não deveria rejeitar (erros de API já viram
        // {ok:false} tratado acima) — mas uma falha de rede real (fetch
        // lançando) rejeitaria o Promise.all inteiro e viraria unhandled
        // rejection no app rodando.
        if (!mountedRef.current) return
        setLoadError('Não foi possível carregar sua agenda (falha de rede).')
      })
  }, [identityResolved, teacherId, tab, date])

  useEffect(() => {
    reloadBookings()
  }, [reloadBookings])

  useEffect(() => {
    if (!participantsBooking) return
    let cancelled = false
    // react-hooks/set-state-in-effect: mesmo motivo do efeito acima — o
    // reset do erro anterior precisa ficar num callback assíncrono.
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

  const arenaGroups = useMemo(() => groupByArenaLabel(bookings), [bookings])
  const teacherClasses = useMemo(() => bookingsToTeacherAgendaClasses(bookings), [bookings])
  /** Mais de uma arena NO PERÍODO EXIBIDO — não "mais de uma membership".
   * Um professor com duas arenas cujo dia inteiro é numa só continua vendo a
   * tela do frame, sem nome de arena repetido em todo bloco. */
  const multiArena = arenaGroups.length > 1

  /** Chips da filterRow — arenas quando há mais de uma, quadras quando não
   * (ver comentário de pacote). Os ids são de universos diferentes, então o
   * filtro guardado é interseccionado com os chips atuais em vez de zerado
   * por um efeito: se o eixo mudar, a seleção antiga simplesmente deixa de
   * casar e vale "sem filtro". */
  const chips = useMemo(() => {
    if (multiArena) {
      return arenaGroups.map((group) => ({ id: group.unitId, label: group.unitName }))
    }
    const seen = new Map<string, string>()
    for (const b of bookings) if (!seen.has(b.courtId)) seen.set(b.courtId, b.courtName)
    const courts = Array.from(seen.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    // Um chip só não é filtro, é decoração — e o frame mobile (35:1096), que
    // é o caso comum do professor (uma quadra no dia), não desenha a
    // filterRow. Com duas ou mais, os chips voltam, como no frame desktop.
    return courts.length > 1 ? courts : []
  }, [multiArena, arenaGroups, bookings])

  const activeFilter = useMemo(() => {
    const ids = new Set(chips.map((chip) => chip.id))
    return filter.filter((id) => ids.has(id))
  }, [filter, chips])

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (b) => activeFilter.length === 0 || activeFilter.includes(multiArena ? b.unitId : b.courtId),
      ),
    [bookings, activeFilter, multiArena],
  )

  function changeDay(delta: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + delta)
    setDate(next)
  }

  const openParticipants = useCallback((booking: Booking) => {
    setParticipants([])
    setParticipantsError(null)
    setParticipantsBooking(booking)
  }, [])

  const openCheckin = useCallback(
    (booking: Booking) => {
      navigate(`/units/${booking.unitId}/bookings/${booking.id}/checkin`, { state: { booking } })
    },
    [navigate],
  )

  /** Um booking -> um bloco da timeline, já com a ação/selo de check-in do
   * desvio documentado acima. */
  const events: AgendaMobileEvent[] = useMemo(
    () =>
      visibleBookings.map((booking) => {
        const state = rowState(now, booking)
        const title = bookingTitle(booking)
        return {
          id: booking.id,
          title,
          subtitle: bookingSubtitle(booking, multiArena),
          start: formatHM(booking.startAt),
          end: formatHM(booking.endAt),
          status: bookingTone(booking),
          action:
            state === 'available'
              ? {
                  label: 'Check-in',
                  contextLabel: `${title} às ${formatTime(booking.startAt)}`,
                  onClick: () => openCheckin(booking),
                }
              : undefined,
          badge: state === 'done' ? '✅ Check-in feito' : undefined,
        }
      }),
    [visibleBookings, multiArena, now, openCheckin],
  )

  const dateGroups = useMemo(() => groupByDate(visibleBookings), [visibleBookings])

  const weekDays = weekDaysSunday(date)
  const daysWithEvents = useMemo(
    () => new Set(bookings.map((b) => formatISODate(new Date(b.startAt)))),
    [bookings],
  )

  /** Uma linha da aba Semana. Mesmo conteúdo do bloco da timeline, em forma
   * de lista — inclusive a ação de check-in, que numa aula de hoje ainda
   * pode estar na janela mesmo com a aba Semana aberta. */
  function renderWeekRow(booking: Booking) {
    const state = rowState(now, booking)
    const title = bookingTitle(booking)
    return (
      <div className="ag4-week-row" key={booking.id}>
        <span className="ag4-week-row__time">{formatTime(booking.startAt)}</span>
        <button
          type="button"
          className="ag4-week-row__body"
          onClick={() => openParticipants(booking)}
        >
          <span className="ag4-week-row__title">{title}</span>
          <span className="ag4-week-row__subtitle">{bookingSubtitle(booking, multiArena)}</span>
        </button>
        {state === 'available' ? (
          <Button variant="primary" size="sm" onClick={() => openCheckin(booking)}>
            Check-in
            <span className="ag4-sr-only"> {title} às {formatTime(booking.startAt)}</span>
          </Button>
        ) : null}
        {state === 'done' ? <Badge tone="success">✅ Check-in feito</Badge> : null}
      </div>
    )
  }

  const weekList = (
    <>
      {dateGroups.length === 0 ? (
        <EmptyState
          icon="🗓"
          title="Semana livre"
          description="Nenhuma aula agendada nesta semana."
        />
      ) : null}
      {dateGroups.map((group) => (
        <div className="ag4-week-group" key={group.label}>
          <div className="ag4-week-group__label">{group.label}</div>
          <div className="ag4-week-group__rows">{group.items.map(renderWeekRow)}</div>
        </div>
      ))}
    </>
  )

  return (
    <div className="ag4-page">
      {loadError ? <p role="alert">{loadError}</p> : null}

      <AgendaMobile
        title="Minhas aulas"
        viewOptions={TABS}
        view={tab}
        onViewChange={(option) => setTab(option === 'Semana' ? 'Semana' : 'Hoje')}
        rangeLabel={formatShortRange(weekDays[0]!, weekDays[6]!)}
        onPrevWeek={() => changeDay(-7)}
        onNextWeek={() => changeDay(7)}
        days={weekDays.map((day) => ({
          date: formatISODate(day),
          hasEvents: daysWithEvents.has(formatISODate(day)),
        }))}
        selectedDate={formatISODate(date)}
        onSelectDate={(iso) => setDate(new Date(`${iso}T00:00:00`))}
        courts={chips}
        selectedCourtIds={activeFilter}
        onToggleCourt={(id) =>
          setFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        filterLabel={multiArena ? 'Filtrar por arena' : 'Filtrar por quadra'}
        events={events}
        onSelectEvent={(id) => {
          const booking = bookings.find((b) => b.id === id)
          if (booking) openParticipants(booking)
        }}
        overlapLanes
        emptyState={
          <EmptyState
            icon="🗓"
            title="Dia livre!"
            description="Nenhuma aula agendada. Aulas novas aparecem aqui."
          />
        }
        actionSlot={
          /* Gate na identidade resolvida (não fail-open) — este é um caminho
             de ESCRITA (cria solicitação em nome do professor), diferente da
             leitura de bookings; mesmo princípio de AG3 (RemarcarSheet só é
             montado com studentId resolvido). */
          teacherId ? <TeacherBlockRequestButton teacherId={teacherId} classes={teacherClasses} /> : undefined
        }
        startHour={GRID_START_HOUR}
        endHour={GRID_END_HOUR}
      >
        {tab === 'Semana' ? weekList : undefined}
      </AgendaMobile>

      <BottomSheet
        open={participantsBooking !== null}
        onClose={() => setParticipantsBooking(null)}
        label="Alunos da Aula"
      >
        {participantsBooking ? (
          <div className="ag4-participants-sheet">
            <h2>
              {bookingTitle(participantsBooking)} · {participants.length}{' '}
              {participants.length === 1 ? 'aluno' : 'alunos'}
            </h2>
            {participantsError ? <p role="alert">{participantsError}</p> : null}
            {/* Aula particular não tem linha em booking_participants (o aluno
                vem em `student_name`), então a lista vem vazia por construção
                — mostrar o nome que JÁ temos é melhor que uma sheet em branco,
                e não inventa endpoint. Sem link para o aluno: `student_id` não
                vem no grid, só o nome. */}
            {participants.length === 0 &&
            participantsBooking.type === 'private' &&
            participantsBooking.studentName ? (
              <p className="ag4-participants-note">{participantsBooking.studentName}</p>
            ) : null}
            <ul className="ag4-participants-list">
              {participants.map((p) => {
                const tierLabel = SKILL_TIERS.find((t) => t.value === p.tier)?.label ?? null
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="ag4-participant-row"
                      onClick={() =>
                        navigate(`/units/${participantsBooking.unitId}/students/${p.studentId}`)
                      }
                    >
                      <span className="ag4-participant-name">{p.studentName ?? 'Aluno'}</span>
                      {tierLabel ? <Badge tone="neutral">{tierLabel}</Badge> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
            {/* Botão "Dar feedback": omitido — sistema de feedback não existe
                em nenhum lugar do backend, mesmo gap do comentário de pacote. */}
          </div>
        ) : null}
      </BottomSheet>
    </div>
  )
}
