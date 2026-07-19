import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { getMe } from '../../lib/api/me'
import { formatWeekdayDate, isSameDay } from './agendaShared'
import '../../components/AuthLayout/AuthLayout.css'
import './Agenda.css'
import './AG3StudentAgendaPage.css'

type Tab = 'prox' | 'hist'

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
 * AG3 — Minha agenda (Aluno), BEAC-1926, story BEAC-1704. Markup/classes
 * (`.dgroup`, `.ag-list`, `.ag-row`, `.tail`) copiados do protótipo real
 * (scr-ag3, artifact "Rallye — Agenda", linhas 658-731 do HTML salvo, lidas
 * integralmente antes de implementar).
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
  const { unitId } = useParams<{ unitId: string }>()
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
  }, [unitId, identityResolved, loggedInStudentId])

  const groups = useMemo(() => groupByDate(bookings), [bookings])

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Marina Costa · Aluna">
      <div className="ag-head">
        <h1>Minha agenda</h1>
        <div className="spacer" />
        <div className="seg2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'prox'}
            className={tab === 'prox' ? 'active' : ''}
            onClick={() => setTab('prox')}
          >
            Próximas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'hist'}
            className={tab === 'hist' ? 'active' : ''}
            onClick={() => setTab('hist')}
          >
            Histórico
          </button>
        </div>
      </div>

      {loadError ? <p role="alert">{loadError}</p> : null}

      {tab === 'prox' ? (
        <div className="dash-body">
          {groups.length === 0 ? <p className="hint">Nenhuma aula nas próximas 2 semanas.</p> : null}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="dgroup">{group.label}</div>
              <div className="ag-list">
                {group.items.map((booking) => (
                  <div className="ag-row" key={booking.id}>
                    <span className="when">
                      {new Date(booking.startAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="strip" />
                    <div className="what">
                      <div className="nm">{booking.className ?? 'Aula particular'}</div>
                      <div className="mt">
                        {booking.teacherName ? `Prof. ${booking.teacherName}` : ''} · {booking.courtName}
                      </div>
                    </div>
                    <div className="tail">
                      <button className="linkbtn" type="button" data-sheet="ag7" disabled title="AG7, não implementado neste dispatch">
                        Remarcar
                      </button>
                      <span className="badge b-success">Confirmada</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button className="btn btn-primary btn-md btn-full" type="button" disabled title="Sem endpoint de agendamento self-service ainda — ver relatório de dispatch">
            Agendar aula
          </button>
          <div className="foot-note">TODO(BEAC-1706): créditos do plano.</div>
        </div>
      ) : (
        <div className="dash-body">
          <p className="hint">
            Histórico indisponível nesta versão — não existe tabela/endpoint de presença no backend ainda
            (BEAC-1906, bloqueado/nunca modelado). Assim que existir, esta aba lista os últimos 3 meses
            agrupados por data, com badges de presença (✓ Presente / ✕ Falta / ◐ Falta justificada) e o
            indicador "⭐ feedback recebido".
          </p>
        </div>
      )}
    </AppShell>
  )
}
