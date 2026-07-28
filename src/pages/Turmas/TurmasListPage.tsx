import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { Input } from '../../components/ui/Input/Input'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { usePermission } from '../../hooks/usePermission'
import { listClasses, type RallyeClass } from '../../lib/api/classes'
import { SPORTS, sportCssVar } from '../../lib/sports'
import { formatDaysAndStart, occupancyOf } from './turmasShared'
import '../../components/AuthLayout/AuthLayout.css'
import './TurmasListPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; classes: RallyeClass[] }

type SportFilter = 'all' | string

/**
 * T1 — Lista de turmas (BEAC-1900, story BEAC-1704 "CRUD de turma com
 * recorrência semanal"). Markup/copy lidos diretamente do protótipo real
 * (Artifact "Rallye — Pessoas & Turmas", seção `scr-t1`, arquivo salvo em
 * .claude/.../tool-results/artifact-bf7a3004-1783743726-dbe8.html linhas
 * ~582-620) — não parafraseado de memória: `.tabs2` (pills horizontais, NÃO
 * dropdown), `.searchbar` (busca única por turma OU professor, sem dropdown
 * de professor separado), `.turma-card` > `.strip` (esporte) + `.tc-main`
 * (h3 nome + `.mt` professor/quadra/dias·horário + `.occ` barra de
 * ocupação), badge "Inativa" + opacidade reduzida para turma inactive.
 *
 * ## GET /units/{id}/classes — endpoint que não existia
 *
 * Não havia nenhum endpoint de LISTAGEM de turmas no backend no momento em
 * que esta task foi dispatchada (só POST/PATCH/DELETE, ver comentário de
 * pacote em rallye-api/api/internal/classes/handler.go). Adicionado nesta
 * mesma dispatch (ListHandler, TDD com testes de integração reais) — decisão
 * autorizada explicitamente pelo escopo desta task ("pode adicionar um
 * handler Go mínimo e bem especificado"), não uma invenção de esquema: só
 * SELECT sobre tabelas que já existem (classes/profiles/courts).
 *
 * QUANDO o chamador é Professor, o próprio ListHandler já devolve só as
 * turmas em que ele é titular (AC "mostrar só as turmas dele") — esta
 * página não re-filtra por professor no cliente, só usa `usePermission
 * ('agenda','write')` para decidir se mostra o botão "Nova turma" (Admin) —
 * "esconder sempre, nunca desabilitar" (usePermission.ts).
 *
 * ## Ocupação — gap conhecido, não fabricado
 *
 * `public.class_enrollments` (quem está matriculado) NÃO existe no backend
 * (mesmo gap documentado no comentário de pacote do handler real). Por
 * isso o "X/Y alunos" do protótipo vira "—/Y alunos" aqui: a capacidade
 * (Y) é real, a matrícula (X) é desconhecida — nunca um número inventado.
 * A barra `.occ .fill` fica visualmente "vazia" (cor neutra) em vez de
 * azul/âmbar, porque não há como saber se está lotada. Ver
 * `occupancyOf`/`OccupancyBadge` abaixo.
 */
export default function TurmasListPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const canManage = usePermission('agenda', 'write')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [sportFilter, setSportFilter] = useState<SportFilter>('all')
  const [showNovaTurmaInfo, setShowNovaTurmaInfo] = useState(false)

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
          setState({ status: 'ready', classes: result.classes })
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

  const allClasses = useMemo(() => (state.status === 'ready' ? state.classes : []), [state])

  // "N ativas" no header reflete o total de turmas ativas visíveis a este
  // chamador (já filtrado por papel no backend), independente dos filtros
  // locais de esporte/busca — mesmo comportamento do protótipo real (o
  // "12 ativas" do header não muda quando a busca/pill filtram a lista).
  const activeCount = useMemo(
    () => allClasses.filter((c) => c.status === 'active').length,
    [allClasses],
  )

  const filteredClasses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allClasses.filter((c) => {
      if (sportFilter !== 'all' && c.sport !== sportFilter) return false
      if (!q) return true
      const haystack = `${c.name} ${c.teacherName ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [allClasses, sportFilter, query])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <h1>Turmas</h1>
        <span className="count">{activeCount} ativas</span>
        <div className="spacer" />
        <div className="turma-search">
          <Input
            type="text"
            placeholder="Buscar turma ou professor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            ariaLabel="Buscar turma ou professor"
          />
        </div>
        {canManage ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowNovaTurmaInfo(true)}
          >
            Nova turma
          </button>
        ) : null}
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <p role="status">Carregando turmas…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar as turmas desta arena.</p>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <div className="tabs2" role="group" aria-label="Filtrar por esporte">
              <button
                type="button"
                className={sportFilter === 'all' ? 'active' : ''}
                aria-pressed={sportFilter === 'all'}
                onClick={() => setSportFilter('all')}
              >
                Todos os esportes
              </button>
              {SPORTS.map((sport) => (
                <button
                  key={sport.slug}
                  type="button"
                  className={sportFilter === sport.slug ? 'active' : ''}
                  aria-pressed={sportFilter === sport.slug}
                  onClick={() => setSportFilter(sport.slug)}
                >
                  <span className="sdot" style={{ background: `var(${sport.cssVar})` }} />
                  {sport.label}
                </button>
              ))}
            </div>

            <div className="ag-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredClasses.length === 0 ? (
                <p className="hint">Nenhuma turma encontrada.</p>
              ) : (
                filteredClasses.map((classItem) => (
                  <TurmaCard
                    key={classItem.id}
                    classItem={classItem}
                    onClick={() => unitId && navigate(`/units/${unitId}/classes/${classItem.id}`)}
                  />
                ))
              )}
            </div>
          </>
        ) : null}
      </div>

      <p className="hint-note">
        Admin vê todas e cria; professor vê só as dele, sem editar. Ocupação (alunos matriculados)
        indisponível nesta versão — depende de <code>public.class_enrollments</code>, que ainda não
        existe no backend; a capacidade mostrada é real.
      </p>

      <BottomSheet
        open={showNovaTurmaInfo}
        onClose={() => setShowNovaTurmaInfo(false)}
        label="Nova turma"
      >
        <div className="ptab-panel">
          <h2 className="sec-head-title">Nova turma</h2>
          <p className="hint">
            O endpoint real já existe (<code>POST /units/{'{id}'}/classes</code>) e está testado,
            mas o formulário de criação (escolher professor/quadra/dias/horário) não faz parte dos
            critérios de aceite desta task (BEAC-1900 só pede o botão visível para Admin) e o
            protótipo não tem uma tela de criação vinculada a este botão. Fora do escopo desta
            dispatch — acompanhar numa task futura (T4/BEAC-1899 já cobre o backend).
          </p>
        </div>
      </BottomSheet>
    </AppShell>
  )
}

function TurmaCard({ classItem, onClick }: { classItem: RallyeClass; onClick: () => void }) {
  const isInactive = classItem.status === 'inactive'
  const occ = occupancyOf(classItem)

  return (
    <button
      type="button"
      className={`turma-card${isInactive ? ' inactive' : ''}`}
      onClick={onClick}
      data-testid={`turma-card-${classItem.id}`}
    >
      <span className="strip" style={{ background: `var(${sportCssVar(classItem.sport)})` }} />
      <span className="tc-main">
        <h3>
          {classItem.name}
          {isInactive ? <Badge tone="neutral">Inativa</Badge> : null}
        </h3>
        <span className="mt">
          {isInactive
            ? `${classItem.teacherName ? `Prof. ${classItem.teacherName}` : 'Sem professor'}`
            : `Prof. ${classItem.teacherName || 'Sem professor'} · ${classItem.courtName || '—'} · ${formatDaysAndStart(classItem.rrule, classItem.startTime)}`}
        </span>
        {!isInactive ? (
          <span className="occ">
            <span className="track">
              <span className="fill fill--unknown" style={{ width: '0%' }} />
            </span>
            <span className="lbl">
              —/{occ.capacity} alunos<span className="visually-hidden"> (matrícula indisponível)</span>
            </span>
          </span>
        ) : null}
      </span>
    </button>
  )
}
