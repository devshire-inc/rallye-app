import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Icon } from '../../components/ui/Icon/Icon'
import { ListRow } from '../../components/ui/ListRow/ListRow'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { getMe } from '../../lib/api/me'
import { listRescheduleCredits } from '../../lib/api/reschedule'
import { getOfferDetail, type OfferDetailResult, type OfferDetailSuccess } from '../../lib/api/waitlist'
import { formatWeekdayDate, isSameDay } from './agendaShared'
import { OfferSheet, type OfferResolvedResult } from './OfferSheet'
import { RemarcarSheet, type RemarcarResult } from './RemarcarSheet'
import { WaitlistSheet, type WaitlistJoinedResult } from './WaitlistSheet'
import '../../components/AuthLayout/AuthLayout.css'
import './Agenda.css'
import './AG3StudentAgendaPage.css'

type Tab = 'prox' | 'hist'

type OfferState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; offer: OfferDetailSuccess }

const OFFER_WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const OFFER_MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "Turma Waitlist · sáb 12 jul, 09:00 · Quadra 1" — mesmo padrão de
 * RemarcarSheet.formatClassSchedule/WaitlistSheetProps.classSchedule (ver
 * comentário daquele componente). Sem nextOccurrenceAt (turma sem ocorrência
 * futura na janela de busca do backend, "avisa, não bloqueia" — ver
 * comentário de pacote em offer_detail_handler.go/rallye-api), cai pra
 * turma + quadra, sem data/hora. */
function formatOfferClassSchedule(offer: OfferDetailSuccess): string {
  if (!offer.nextOccurrenceAt) return `${offer.className} · ${offer.courtName}`
  const d = new Date(offer.nextOccurrenceAt)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${offer.className} · ${OFFER_WEEKDAY_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${OFFER_MONTH_SHORT[d.getMonth()]}, ${time} · ${offer.courtName}`
}

type CreditsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; count: number }

function creditsFootNote(state: CreditsState): string | null {
  if (state.status !== 'ready') return null
  return `${state.count} ${state.count === 1 ? 'crédito disponível' : 'créditos disponíveis'} este mês`
}

function groupByDate(bookings: Booking[]): { label: string; items: Booking[] }[] {
  const groups = new Map<string, Booking[]>()
  for (const b of bookings) {
    const d = new Date(b.startAt)
    const key = d.toDateString()
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
 * AG3 — Minha agenda (Aluno), BEAC-1926, story BEAC-1704. Reskin (rodada
 * posterior, sem story própria — pareado ao reskin do AppShell) com os
 * componentes reais do design system, seguindo os frames Figma "02 · Minha
 * Agenda — Aluno" (Mobile 36:1093 / Desktop 100:2523) e o estado vazio "02b"
 * (187:2916): `Tabs` para Próximas/Histórico, `ListRow` (leading=strip,
 * trailing=custom) para cada reserva — o Figma usa exatamente esse "List
 * Row" (tarja de 4px + Badge de status), `AlertCard` para mensagens de
 * erro/status e `EmptyState` para "Sem aulas por aqui". `.dgroup`/`.ag-list`
 * (rótulo de data + wrapper da lista) seguem vindo de Agenda.css — não são um
 * componente do DS, só um separador de seção compartilhado com AG1/AG2/AG4.
 * `ListRow.title` foi ampliado pra `ReactNode` e ganhou um trailing
 * `type: 'custom'` (ver ListRow.tsx) especificamente para caber o botão
 * "Remarcar" + Badge lado a lado — o Figma não mostra esse botão na linha
 * (provavelmente fora do escopo do protótipo estático), mas a lógica de
 * negócio existente (abrir RemarcarSheet a partir de qualquer linha) não
 * podia ser removida.
 *
 * ESCOPO POR ALUNO (corrigido na rodada de correção 2, achado do review de
 * BEAC-1926 — vazamento de privacidade): a aba "Próximas" agora busca o
 * profile id do usuário logado via GET /me (../../lib/api/me.ts, novo
 * endpoint desta rodada — rodada 1 tinha investigado e confirmado que
 * nada no frontend expunha essa informação antes) e passa esse id como
 * `student_id` pra GET /units/{id}/bookings (../../lib/api/bookings.ts).
 * Isso filtra reservas type=private/day_use — resolve o vazamento
 * original (um aluno via nome do professor/quadra/horário das aulas
 * particulares de OUTROS alunos).
 *
 * LIMITAÇÃO CONHECIDA, que PERMANECE (documentada pelo reviewer, não nova
 * nem resolvida por este fix): o filtro student_id NUNCA cobre
 * `class_occurrence` (ocorrências de turma) — bookings.student_id não é
 * preenchido para esse tipo, porque não existe `class_enrollments` no
 * schema para saber quais alunos estão matriculados em qual turma. Esse
 * gap está sendo fechado por uma dispatch PARALELA (BEAC-1861/1862,
 * Épico 4) — fora do escopo desta correção. Quando aquela tabela existir,
 * a query de bookings.GridHandler (rallye-api) precisará de um JOIN
 * adicional para também escopar ocorrências de turma por aluno.
 *
 * Se GET /me falhar (ex.: sessão temporary, 403) ou o profile id ainda não
 * tiver carregado, a aba busca sem student_id (mesmo comportamento de
 * antes desta correção) em vez de travar a tela — ver loggedInStudentId
 * abaixo.
 *
 * GAP CONHECIDO — Tab Histórico: não existe tabela/endpoint de presença
 * (BEAC-1906, confirmado bloqueado/nunca modelado) — implementado só o shell
 * da aba, com estado vazio explícito, sem inventar dado de presença.
 *
 * "Agendar aula": sem flag de self-service em nenhum módulo de
 * src/lib/api existente (só unitSettings.ts, que só tem
 * delinquency-block-level) — decisão desta implementação: sempre mostrar o
 * botão (default seguro per instrução do dispatch), como stub desabilitado
 * (nenhum endpoint de agendamento self-service existe ainda) — questão em
 * aberto no relatório.
 */
export default function AG3StudentAgendaPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('prox')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // loggedInStudentId: resolvido via GET /me (ver comentário de módulo).
  // identityResolved só vira true depois que a chamada a GET /me termina
  // (sucesso OU falha) — a busca de bookings abaixo espera por isso antes
  // de disparar, pra nunca renderizar (nem momentaneamente) a lista
  // NÃO filtrada por aluno enquanto o id ainda está carregando.
  const [loggedInStudentId, setLoggedInStudentId] = useState<string | undefined>(undefined)
  const [identityResolved, setIdentityResolved] = useState(false)

  // remarcarOpen/remarcarMessage: sheet AG7 "Remarcar" (BEAC-1912, story
  // BEAC-1705). Não é escopado a UMA linha específica — opera sobre os
  // créditos de reagendamento JÁ concedidos ao aluno (gerados por um
  // cancelamento anterior, BEAC-1909/1913), não sobre o booking da linha
  // clicada — por isso qualquer botão "Remarcar" da lista abre a MESMA
  // instância do sheet. refreshKey força o useEffect de busca de bookings
  // abaixo a rodar de novo depois de uma remarcação aplicada (novo booking
  // de destino pode não estar refletido na lista atual ainda).
  const [remarcarOpen, setRemarcarOpen] = useState(false)
  const [remarcarMessage, setRemarcarMessage] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // waitlistOpen/waitlistTarget: sheet AG8 "Fila de espera" (BEAC-1922, story
  // BEAC-1708), aberto a partir de uma linha lotada dentro do sheet AG7
  // "Remarcar" (RemarcarSheet.onRequestWaitlist) — correção desta rodada
  // (handover: "conectar Lista de Espera ao fluxo de Remarcar"). Nunca
  // aninhado no sheet Remarcar: fecha um, abre o outro, mesmo padrão de
  // controle-pela-página já usado pelos outros sheets desta página.
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistTarget, setWaitlistTarget] = useState<{ classId: string; classSchedule: string } | null>(null)
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null)

  // creditsState (BEAC-1706/1915): contagem REAL de créditos de
  // reagendamento disponíveis, pro footer e pro gate do botão "Remarcar".
  // Falha aberto (fail-open) em loading/error — igual ao resto desta
  // página (ver loggedInStudentId acima): nunca bloqueia a tela por causa
  // desta info secundária. RemarcarSheet ainda revalida os créditos ao
  // abrir o sheet, então este gate é só uma camada extra de UX, não a
  // única proteção contra remarcar sem crédito.
  const [creditsState, setCreditsState] = useState<CreditsState>({ status: 'loading' })

  // offerState/offerMessage: sheet AG9 "Confirmação de vaga" (BEAC-1923),
  // aberto a partir de ?offer=<entryId> na URL (BEAC-1724/BEAC-2023) — o tap
  // numa notificação vaga_waitlist (push nativo ou N1) navega pra cá com
  // esse param via notificationRouting.ts. entryId é o único dado que a
  // notificação carrega; o resto (turma, professor, ocupação, expires_at)
  // é buscado aqui via GET /waitlist/{id} antes do sheet abrir.
  const offerEntryId = searchParams.get('offer')
  // offerFetch guarda o ÚLTIMO resultado buscado JUNTO com o entryId a que
  // ele pertence — offerState (abaixo) deriva 'loading' puramente comparando
  // offerFetch.entryId com offerEntryId atual, em vez do efeito chamar
  // setState síncrono pra marcar "carregando" (o que dispararia o lint
  // react-hooks/set-state-in-effect — só é permitido chamar setState de
  // dentro do callback assíncrono, mesma regra já documentada em
  // OfferSheet.tsx). Isso também resolve de graça o caso de trocar de uma
  // oferta pra outra sem passar por "idle" no meio: enquanto a busca da
  // nova entryId não volta, offerFetch ainda aponta pra entryId antiga,
  // então o derive abaixo cai em 'loading', nunca mostra o resultado stale.
  const [offerFetch, setOfferFetch] = useState<{ entryId: string; result: OfferDetailResult } | null>(null)
  const [offerMessage, setOfferMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!offerEntryId) return
    let cancelled = false
    getOfferDetail(offerEntryId).then((result) => {
      if (cancelled) return
      setOfferFetch({ entryId: offerEntryId, result })
    })
    return () => {
      cancelled = true
    }
  }, [offerEntryId])

  const offerState: OfferState = !offerEntryId
    ? { status: 'idle' }
    : offerFetch?.entryId !== offerEntryId
      ? { status: 'loading' }
      : !offerFetch.result.ok
        ? { status: 'error', message: 'Não foi possível carregar esta oferta — ela pode já ter sido resolvida ou expirado.' }
        : { status: 'ready', offer: offerFetch.result }

  useEffect(() => {
    let cancelled = false
    getMe().then((result) => {
      if (cancelled) return
      if (result.ok) setLoggedInStudentId(result.id)
      // Falha (ex.: 403 de sessão temporary): segue sem student_id — ver
      // comentário de módulo. Não bloqueia a tela.
      setIdentityResolved(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!unitId || !identityResolved) return
    let cancelled = false
    const from = new Date()
    const to = new Date()
    to.setDate(to.getDate() + 14)
    getBookingsGrid(unitId, from.toISOString(), to.toISOString(), undefined, loggedInStudentId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setLoadError(`Não foi possível carregar sua agenda (${result.error}).`)
        return
      }
      setLoadError(null)
      setBookings(
        result.bookings.filter((b) => b.status === 'confirmed' && b.type !== 'block' && b.type !== 'rental'),
      )
    })
    return () => {
      cancelled = true
    }
  }, [unitId, identityResolved, loggedInStudentId, refreshKey])

  useEffect(() => {
    if (!identityResolved || !loggedInStudentId) return
    let cancelled = false
    listRescheduleCredits(loggedInStudentId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setCreditsState({ status: 'error' })
        return
      }
      setCreditsState({ status: 'ready', count: result.credits.length })
    })
    return () => {
      cancelled = true
    }
  }, [identityResolved, loggedInStudentId, refreshKey])

  const groups = useMemo(() => groupByDate(bookings), [bookings])
  const hasNoCredits = creditsState.status === 'ready' && creditsState.count === 0

  function handleRescheduled(result: RemarcarResult) {
    setRemarcarOpen(false)
    setRemarcarMessage(
      result.status === 'pending_approval'
        ? 'Pedido de remarcação enviado — aguardando aprovação do admin.'
        : 'Remarcação aplicada com sucesso!',
    )
    setRefreshKey((k) => k + 1)
  }

  function handleRequestWaitlist(classId: string, classSchedule: string) {
    setRemarcarOpen(false)
    setWaitlistMessage(null)
    setWaitlistTarget({ classId, classSchedule })
    setWaitlistOpen(true)
  }

  function handleWaitlistJoined(result: WaitlistJoinedResult) {
    setWaitlistOpen(false)
    setWaitlistMessage(`Você entrou na fila de espera — posição #${result.position}.`)
  }

  // closeOfferSheet remove ?offer= da URL (replace: não empilha histórico) —
  // offerState deriva pra 'idle' sozinho quando offerEntryId some, nenhum
  // setState direto necessário aqui. Reabrir a página sem o param nunca
  // reabre o sheet sozinho. Usado tanto por onCancel (fecha sem resolver, a
  // oferta continua 'offered' no servidor) quanto depois de onResolved.
  function closeOfferSheet() {
    const next = new URLSearchParams(searchParams)
    next.delete('offer')
    setSearchParams(next, { replace: true })
  }

  function handleOfferResolved(result: OfferResolvedResult) {
    setOfferMessage(
      result.status === 'accepted'
        ? 'Vaga confirmada! A aula já apareceu na sua agenda.'
        : result.status === 'declined'
          ? 'Você recusou a vaga — ela passou pro próximo da fila.'
          : 'O prazo pra confirmar expirou — a vaga passou pro próximo da fila.',
    )
    closeOfferSheet()
    setRefreshKey((k) => k + 1)
  }

  const tabValue = tab === 'prox' ? 'Próximas' : 'Histórico'

  function handleTabChange(next: string) {
    setTab(next === 'Próximas' ? 'prox' : 'hist')
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="dash-body">
        <h1>Minha agenda</h1>
        <Tabs tabs={['Próximas', 'Histórico']} value={tabValue} onChange={handleTabChange} ariaLabel="Abas da agenda" />

        {loadError ? (
          <div role="alert">
            <AlertCard tone="danger" showIcon>
              {loadError}
            </AlertCard>
          </div>
        ) : null}
        {remarcarMessage ? (
          <div role="status">
            <AlertCard tone="success" showIcon>
              {remarcarMessage}
            </AlertCard>
          </div>
        ) : null}
        {waitlistMessage ? (
          <div role="status">
            <AlertCard tone="success" showIcon>
              {waitlistMessage}
            </AlertCard>
          </div>
        ) : null}
        {offerMessage ? (
          <div role="status">
            <AlertCard tone="success" showIcon>
              {offerMessage}
            </AlertCard>
          </div>
        ) : null}

        {tab === 'prox' ? (
          <>
            {groups.length === 0 ? (
              <EmptyState
                icon={<Icon name="calendar" size={40} />}
                title="Sem aulas por aqui"
                description="Que tal agendar seu próximo horário na arena?"
              />
            ) : (
              groups.map((group) => (
                <div key={group.label}>
                  <div className="dgroup">{group.label}</div>
                  <div className="ag-list">
                    {group.items.map((booking) => {
                      const time = new Date(booking.startAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      const title = booking.className ?? 'Aula particular'
                      const meta = `${booking.teacherName ? `Prof. ${booking.teacherName} · ` : ''}${booking.courtName}`
                      return (
                        <ListRow
                          key={booking.id}
                          leading={{ type: 'strip', color: 'var(--state-success)' }}
                          title={
                            <>
                              <span className="ag-row-time">{time}</span> · <span>{title}</span>
                            </>
                          }
                          meta={meta}
                          trailing={{
                            type: 'custom',
                            children: (
                              <div className="ag-row-actions">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={hasNoCredits}
                                  title={
                                    hasNoCredits
                                      ? 'Nenhum crédito de reagendamento disponível este mês'
                                      : undefined
                                  }
                                  onClick={() => {
                                    setRemarcarMessage(null)
                                    setRemarcarOpen(true)
                                  }}
                                >
                                  Remarcar
                                </Button>
                                <Badge tone="success">Confirmada</Badge>
                              </div>
                            ),
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))
            )}

            <Button
              variant="primary"
              size="md"
              fullWidth
              disabled
              title="Sem endpoint de agendamento self-service ainda — ver relatório de dispatch"
            >
              Agendar aula
            </Button>
            {creditsFootNote(creditsState) ? <div className="foot-note">{creditsFootNote(creditsState)}</div> : null}
          </>
        ) : (
          <AlertCard tone="info" showIcon>
            Histórico indisponível nesta versão — não existe tabela/endpoint de presença no backend ainda
            (BEAC-1906, bloqueado/nunca modelado). Assim que existir, esta aba lista os últimos 3 meses
            agrupados por data, com badges de presença (✓ Presente / ✕ Falta / ◐ Falta justificada) e o
            indicador "⭐ feedback recebido".
          </AlertCard>
        )}
      </div>

      <BottomSheet open={remarcarOpen} onClose={() => setRemarcarOpen(false)} label="Remarcar">
        {unitId && loggedInStudentId ? (
          <RemarcarSheet
            unitId={unitId}
            studentId={loggedInStudentId}
            onRescheduled={handleRescheduled}
            onRequestWaitlist={handleRequestWaitlist}
            onCancel={() => setRemarcarOpen(false)}
          />
        ) : (
          <div role="alert">
            <AlertCard tone="danger" showIcon>
              Não foi possível identificar sua conta para remarcar (tente recarregar a página).
            </AlertCard>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={waitlistOpen} onClose={() => setWaitlistOpen(false)} label="Fila de espera">
        {waitlistTarget && loggedInStudentId ? (
          <WaitlistSheet
            classId={waitlistTarget.classId}
            studentId={loggedInStudentId}
            classSchedule={waitlistTarget.classSchedule}
            onJoined={handleWaitlistJoined}
            onCancel={() => setWaitlistOpen(false)}
          />
        ) : (
          <div role="alert">
            <AlertCard tone="danger" showIcon>
              Não foi possível identificar sua conta para entrar na fila (tente recarregar a página).
            </AlertCard>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={offerState.status !== 'idle'} onClose={closeOfferSheet} label="Vaga disponível">
        {offerState.status === 'loading' ? <AlertCard tone="info">Carregando oferta…</AlertCard> : null}
        {offerState.status === 'error' ? (
          <div role="alert">
            <AlertCard tone="danger" showIcon>
              {offerState.message}
            </AlertCard>
          </div>
        ) : null}
        {offerState.status === 'ready' ? (
          <OfferSheet
            entryId={offerState.offer.entryId}
            expiresAt={offerState.offer.expiresAt}
            classSchedule={formatOfferClassSchedule(offerState.offer)}
            teacherName={offerState.offer.teacherName}
            activeEnrollments={offerState.offer.activeEnrollments}
            capacity={offerState.offer.capacity}
            onResolved={handleOfferResolved}
            onCancel={closeOfferSheet}
          />
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}
