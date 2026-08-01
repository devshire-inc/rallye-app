import { useCallback, useEffect, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { addBookingParticipant, type Participant } from '../../lib/api/bookings'
import { listMembers, type Member } from '../../lib/api/members'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './AddStudentSheet.css'

export interface AddStudentSheetProps {
  unitId: string
  bookingId: string
  /** Chamado depois que o aluno foi de fato adicionado (participante já
   * existe em public.booking_participants) — inclusive quando
   * `capacityWarning` é true, já que o AC é "avisa, não bloqueia": a adição
   * já aconteceu, isto só sinaliza o pai para fechar/atualizar a tela. */
  onAdded: (participant: Participant) => void
  onCancel: () => void
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; students: Member[] }

/**
 * Conteúdo do BottomSheet aberto pelo botão "👤 Adicionar aluno" nas Ações do
 * Admin de AG5 (BEAC-1918, story BEAC-1707 — "Botão de adicionar aluno extra
 * em AG5 com aviso de capacidade").
 *
 * # Busca de alunos da unit — sem componente de picker dedicado ainda
 *
 * Não existe (nem existia antes desta task, ver comentário de pacote em
 * NovaReservaSheet.tsx: "não existe GET /units/{id}/students lista/busca")
 * nenhum componente de people-search/picker padronizado neste app. O que
 * existe É um endpoint de busca real e já em produção — GET
 * /units/{id}/members?q= (BEAC-1844/1845, listMembers em
 * ../../lib/api/members.ts) — que devolve TODOS os membros da unit (com
 * nome/e-mail/papel), não só alunos. Decisão desta task: reaproveitar esse
 * endpoint em vez de inventar um novo (`GET /units/{id}/students` de busca
 * não foi pedido nesta dispatch, e criar um endpoint novo estaria fora do
 * escopo das 3 tasks recebidas), filtrando client-side por
 * `member.role?.name === 'Aluno'` — mesmo espírito de filtro client-side já
 * usado por TurmaDetailPage.tsx (aba "Próximas", filtra bookings por
 * classId no cliente por não valer a pena pedir uma mudança de contrato só
 * para isso).
 *
 * GAP CONHECIDO — permissão da BUSCA (não da adição): GET /units/{id}/members
 * exige a permission `config`/`write` (api/cmd/server/main.go,
 * `membersAuth`), não `agenda`/`write`. A ação de ADICIONAR em si (POST
 * /bookings/{id}/participants, BEAC-1917) já é corretamente restrita a
 * `agenda`/`write` (o critério de permissão real do AC desta story) — mas um
 * Professor (que tem `agenda:write` só para a própria agenda, migrations/
 * 000016, e NÃO tem `config:write`) veria esta busca falhar com 403 mesmo
 * tendo acesso ao botão (o botão em si só aparece dentro do bloco "Ações do
 * Admin" de AG5, hoje gated por `isAdmin` = usePermission('agenda','write') —
 * um heurístico JÁ documentado como não confiável no comentário de pacote de
 * AG5BookingDetailPage.tsx, anterior a esta task). Não corrigido aqui: criar
 * um endpoint de busca de alunos com permission `agenda` seria uma mudança
 * de contrato de backend fora das 3 tasks desta dispatch — reportado como
 * questão em aberto no relatório de execução, não uma decisão de design
 * silenciosa.
 */
export function AddStudentSheet({ unitId, bookingId, onAdded, onCancel }: AddStudentSheetProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [warning, setWarning] = useState<{ studentName: string; participant: Participant } | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      listMembers(unitId, debouncedQuery)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', students: result.members.filter((m) => m.role?.name === 'Aluno') })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, debouncedQuery],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handlePick(student: Member) {
    if (addingId !== null) return
    setAddError(null)
    setAddingId(student.user.id)
    const result = await addBookingParticipant(bookingId, student.user.id)
    setAddingId(null)

    if (!result.ok) {
      setAddError(
        result.error === 'already_participant'
          ? 'Este aluno já foi adicionado a esta aula.'
          : 'Não foi possível adicionar o aluno agora. Tente novamente.',
      )
      return
    }

    if (result.participant.capacityWarning) {
      // AC central de BEAC-1707: a adição JÁ aconteceu (avisa, não
      // bloqueia) — este banner só informa o admin, "confirmar" aqui é só
      // reconhecer o aviso e fechar, não uma segunda chamada à API.
      setWarning({ studentName: student.user.name, participant: result.participant })
      return
    }

    onAdded(result.participant)
  }

  if (warning) {
    return (
      <div className="add-student-sheet">
        <h2 className="sec-head-title">Adicionar aluno</h2>
        <p role="alert" className="add-student-warning">
          <strong>{warning.studentName}</strong> foi adicionado, mas esta turma está acima da capacidade
          recomendada.
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onAdded(warning.participant)}>
          Ok, entendi
        </button>
      </div>
    )
  }

  return (
    <div className="add-student-sheet">
      <h2 className="sec-head-title">Adicionar aluno</h2>

      <div className="add-student-search">
        <input
          type="text"
          placeholder="Nome ou e-mail..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar aluno"
        />
      </div>

      {state.status === 'loading' ? <PageLoading label="Carregando alunos" variant="list" rows={3} /> : null}
      {state.status === 'error' ? <p role="alert">Não foi possível buscar alunos agora.</p> : null}

      {state.status === 'ready' ? (
        <div className="add-student-list">
          {state.students.length === 0 ? (
            <p className="hint">Nenhum aluno encontrado.</p>
          ) : (
            state.students.map((student) => (
              <button
                type="button"
                key={student.membershipId}
                className="add-student-row"
                disabled={addingId !== null}
                onClick={() => handlePick(student)}
              >
                <span className="avatar-sm">{initials(student.user.name)}</span>
                <div>
                  <div className="nm">{student.user.name}</div>
                  {student.user.email ? <div className="mt">{student.user.email}</div> : null}
                </div>
                {addingId === student.user.id ? <span className="hint">adicionando…</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}

      {addError ? (
        <p role="alert" className="field-error">
          {addError}
        </p>
      ) : null}

      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  )
}

/** Iniciais de 2 letras (mesmo padrão de MembersPage.tsx). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
