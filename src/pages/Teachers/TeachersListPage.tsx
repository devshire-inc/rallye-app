import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { usePermission } from '../../hooks/usePermission'
import { listTeachers, type TeacherListItem } from '../../lib/api/teachers'
import { sportCssVar } from '../../lib/sports'
import { formatRemunerationSummary, initials } from './teachersShared'
import '../../components/AuthLayout/AuthLayout.css'
import './TeachersListPage.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; teachers: TeacherListItem[] }

/**
 * PR1 — Lista de Professores (BEAC-1880, épico 5). Markup/copy lidos
 * diretamente do protótipo real (Artifact "Rallye — Pessoas & Turmas",
 * seção `scr-pr1`): header com título + badge de contagem total, campo de
 * busca "Buscar professor...", botão primário "+ Novo professor"; cada linha
 * com avatar de iniciais, dots de esporte + "N turmas", resumo de
 * remuneração alinhado à direita e pill de status.
 *
 * Consome GET /units/{id}/teachers (BEAC-1880/Wave 1, rallye-api). A busca
 * por nome é feita no SERVIDOR (?search=) — diferente de TurmasListPage
 * (filtro 100% client-side), porque o handover desta story pediu
 * explicitamente que o endpoint suportasse ?search=. SEM debounce: cada
 * tecla dispara uma nova chamada (só o `cancelled` flag do efeito descarta
 * respostas obsoletas) — aceitável no volume desta tela, mas revisitar se
 * a lista de professores crescer o bastante para o custo de rede pesar.
 *
 * "+ Novo professor" navega para PR3 (BEAC-1875, cadastro de professor) —
 * TODO(BEAC-1875): PR3 ainda não existe nesta base (nenhuma rota registrada
 * em App.tsx). O botão é sempre visível para quem tem `professores:write`
 * (aponta para uma rota ainda não registrada; como só existe a rota dinâmica
 * `/units/:unitId/teachers/:teacherId`, react-router casa "new" como
 * teacherId e a navegação renderiza TeacherProfilePage com um 404 "Professor
 * não encontrado" — efeito visível, mas inofensivo, até PR3 ser construído
 * numa task própria, fora do escopo desta dispatch).
 *
 * Permissão: `professores:write` controla o botão "+ Novo professor" —
 * "esconder sempre, nunca desabilitar" (usePermission.ts). A leitura da
 * lista em si depende só de `professores:read`, que qualquer role com
 * membership ativa tem na matriz de seed (Admin sempre; Professor NÃO tem
 * professores:read — mas esta tela é exclusivamente Admin, PR1 nunca é
 * roteada para um Professor pela navegação principal do app).
 */
export default function TeachersListPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const canCreate = usePermission('professores', 'write')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')

  const load = useCallback(
    (search: string, onCancelled: () => boolean) => {
      const request = unitId
        ? listTeachers(unitId, search)
        : Promise.reject(new Error('missing_unit_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', teachers: result.teachers })
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
    load(query, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [load, query])

  const teachers = useMemo(() => (state.status === 'ready' ? state.teachers : []), [state])

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
      <div className="pg-head">
        <h1>Professores</h1>
        <span className="count">{teachers.length}</span>
        <div className="spacer" />
        <div className="searchbar">
          <input
            type="text"
            placeholder="Buscar professor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar professor"
          />
        </div>
        {canCreate ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate(unitId ? `/units/${unitId}/teachers/new` : '/perfil')}
          >
            + Novo professor
          </button>
        ) : null}
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <p role="status">Carregando professores…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar os professores desta arena.</p>
        ) : null}

        {state.status === 'ready' ? (
          <div className="ag-list" style={{ gap: 8 }}>
            {teachers.length === 0 ? (
              <p className="hint">
                {query.trim() === ''
                  ? 'Nenhum professor cadastrado ainda.'
                  : 'Nenhum professor encontrado para esta busca.'}
              </p>
            ) : (
              teachers.map((teacher) => (
                <TeacherRow
                  key={teacher.id}
                  teacher={teacher}
                  onClick={() => unitId && navigate(`/units/${unitId}/teachers/${teacher.id}`)}
                />
              ))
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

const STATUS_LABEL: Record<TeacherListItem['status'], string> = {
  pending: 'Pendente',
  active: 'Ativo',
  inactive: 'Inativo',
}

const STATUS_BADGE_CLASS: Record<TeacherListItem['status'], string> = {
  pending: 'badge b-warning',
  active: 'badge b-success',
  inactive: 'badge b-neutral',
}

function TeacherRow({ teacher, onClick }: { teacher: TeacherListItem; onClick: () => void }) {
  return (
    <button
      type="button"
      className="p-row"
      onClick={onClick}
      data-testid={`teacher-row-${teacher.id}`}
    >
      <span className="avatar-sm">{initials(teacher.fullName)}</span>
      <div className="pw">
        <div className="nm">{teacher.fullName}</div>
        <div className="mt">
          {teacher.sports.map((sport) => (
            <span
              key={sport}
              className="sdot"
              style={{ background: `var(${sportCssVar(sport)})` }}
            />
          ))}
          {teacher.sports.length > 0 ? ' · ' : ''}
          {teacher.turmasCount} {teacher.turmasCount === 1 ? 'turma' : 'turmas'}
        </div>
      </div>
      <div className="tail">
        <span>
          {formatRemunerationSummary(teacher.remunerationModel, teacher.remunerationValue)}
        </span>
        <span className={STATUS_BADGE_CLASS[teacher.status]}>{STATUS_LABEL[teacher.status]}</span>
      </div>
    </button>
  )
}
