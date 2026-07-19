import { useEffect, useState } from 'react'
import { listCourts, type Court } from '../../lib/api/courts'
import { deactivateClass, patchClass, type RallyeClass } from '../../lib/api/classes'

type View = 'menu' | 'editar-dados' | 'trocar-quadra' | 'alterar-horario' | 'desativar'

export interface ClassSettingsSheetProps {
  unitId: string
  classItem: RallyeClass
  onUpdated: (updated: RallyeClass) => void
  onDeactivated: (updated: RallyeClass) => void
  onClose: () => void
}

/**
 * Conteúdo do BottomSheet [⚙️] de T2 (BEAC-1901): "editar dados, trocar
 * professor, trocar quadra, alterar horário, relatório de frequência,
 * desativar turma" — chama PATCH/DELETE /classes/{id} (../../lib/api/
 * classes.ts), já testados no backend (ver
 * api/internal/classes/handler_integration_test.go).
 *
 * Dois itens do menu real (AC) não têm dependência real disponível ainda —
 * tratados como itens desabilitados com explicação, não fabricados:
 *   - "Trocar professor": não existe nenhum endpoint de LISTAGEM de
 *     professores da unit (só POST /units/{id}/teachers, criação) — sem uma
 *     lista, não há como montar um seletor real sem pedir que o admin
 *     digite um UUID de cor (péssima UX, e adivinhar esse formulário não é
 *     uma decisão de produto que esta task deveria tomar sozinha).
 *   - "Relatório de frequência": não existe nenhuma tabela de presença/
 *     check-in no backend (mesmo gap de BEAC-1906, já reportado como
 *     bloqueado no handover desta story) — não há dado nenhum para
 *     relatar.
 * "Editar dados" (nome/capacidade/nível) e "Trocar quadra" (GET
 * /units/{id}/courts, endpoint real adicionado nesta mesma dispatch para
 * AG1/AG2/AG6) e "Alterar horário" e "Desativar turma" são reais.
 */
export function ClassSettingsSheet({
  unitId,
  classItem,
  onUpdated,
  onDeactivated,
  onClose,
}: ClassSettingsSheetProps) {
  const [view, setView] = useState<View>('menu')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(classItem.name)
  const [capacity, setCapacity] = useState(String(classItem.capacity))
  const [level, setLevel] = useState(classItem.level ?? '')

  const [courts, setCourts] = useState<Court[] | null>(null)
  const [selectedCourtId, setSelectedCourtId] = useState(classItem.courtId)

  const [startTime, setStartTime] = useState(classItem.startTime)
  const [endTime, setEndTime] = useState(classItem.endTime)

  useEffect(() => {
    if (view !== 'trocar-quadra' || courts !== null) return
    let cancelled = false
    listCourts(unitId).then((result) => {
      if (cancelled) return
      setCourts(result.ok ? result.courts : [])
    })
    return () => {
      cancelled = true
    }
  }, [view, courts, unitId])

  async function submitPatch(payload: Parameters<typeof patchClass>[1]) {
    setBusy(true)
    setError(null)
    const result = await patchClass(classItem.id, payload)
    setBusy(false)
    if (!result.ok) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }
    // PATCH não devolve teacher_name/court_name (só GET /units/{id}/classes
    // enriquece via JOIN) — preserva os nomes já carregados e só sobrescreve
    // court_name quando a própria troca de quadra foi o que mudou (a partir
    // da lista já buscada para o picker).
    const courtName =
      payload.courtId !== undefined
        ? (courts ?? []).find((c) => c.id === payload.courtId)?.name
        : classItem.courtName
    onUpdated({ ...result.rallyeClass, teacherName: classItem.teacherName, courtName })
    setView('menu')
  }

  async function submitDeactivate() {
    setBusy(true)
    setError(null)
    const result = await deactivateClass(classItem.id)
    setBusy(false)
    if (!result.ok) {
      setError('Não foi possível desativar a turma. Tente novamente.')
      return
    }
    onDeactivated({ ...result.rallyeClass, teacherName: classItem.teacherName, courtName: classItem.courtName })
  }

  if (view === 'menu') {
    return (
      <div className="settings-sheet">
        <div className="settings-sheet__head">
          <h2 className="sec-head-title">Configurações da turma</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="menu-list">
          <button type="button" className="role-row role-row--clickable" onClick={() => setView('editar-dados')}>
            <span className="rn">Editar dados</span>
          </button>
          <button type="button" className="role-row" disabled title="Sem endpoint de listagem de professores (GET /units/{id}/teachers) ainda">
            <span className="rn">Trocar professor</span>
            <span className="hint">Indisponível — sem endpoint de listagem de professores</span>
          </button>
          <button type="button" className="role-row role-row--clickable" onClick={() => setView('trocar-quadra')}>
            <span className="rn">Trocar quadra</span>
          </button>
          <button type="button" className="role-row role-row--clickable" onClick={() => setView('alterar-horario')}>
            <span className="rn">Alterar horário</span>
          </button>
          <button type="button" className="role-row" disabled title="Sem tabela de presença/check-in no backend ainda (mesmo gap de BEAC-1906)">
            <span className="rn">Relatório de frequência</span>
            <span className="hint">Indisponível — sem dado de presença no backend</span>
          </button>
          <button type="button" className="role-row role-row--clickable" onClick={() => setView('desativar')}>
            <span className="rn" style={{ color: 'var(--error-fg)' }}>
              Desativar turma
            </span>
          </button>
        </div>
      </div>
    )
  }

  if (view === 'editar-dados') {
    return (
      <div className="settings-sheet">
        <h2 className="sec-head-title">Editar dados</h2>
        <label className="field">
          <span>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Capacidade</span>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Nível</span>
          <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Opcional" />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')} disabled={busy}>
            Voltar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !name.trim() || Number(capacity) <= 0}
            onClick={() =>
              submitPatch({
                name: name.trim(),
                capacity: Number(capacity),
                level: level.trim() || undefined,
              })
            }
          >
            Salvar
          </button>
        </div>
      </div>
    )
  }

  if (view === 'trocar-quadra') {
    return (
      <div className="settings-sheet">
        <h2 className="sec-head-title">Trocar quadra</h2>
        {courts === null ? (
          <p role="status">Carregando quadras…</p>
        ) : (
          <label className="field">
            <span>Quadra</span>
            <select value={selectedCourtId} onChange={(e) => setSelectedCourtId(e.target.value)}>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error ? <p role="alert">{error}</p> : null}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')} disabled={busy}>
            Voltar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || courts === null}
            onClick={() => submitPatch({ courtId: selectedCourtId })}
          >
            Salvar
          </button>
        </div>
      </div>
    )
  }

  if (view === 'alterar-horario') {
    return (
      <div className="settings-sheet">
        <h2 className="sec-head-title">Alterar horário</h2>
        <label className="field">
          <span>Início</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="field">
          <span>Fim</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')} disabled={busy}>
            Voltar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !startTime || !endTime}
            onClick={() => submitPatch({ startTime, endTime })}
          >
            Salvar
          </button>
        </div>
      </div>
    )
  }

  // view === 'desativar'
  return (
    <div className="settings-sheet">
      <h2 className="sec-head-title">Desativar turma</h2>
      <p className="hint">
        A turma ficará inativa e as próximas ocorrências já agendadas são canceladas
        automaticamente. Esta ação não pode ser desfeita por aqui.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="sheet-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')} disabled={busy}>
          Voltar
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={submitDeactivate}>
          Confirmar desativação
        </button>
      </div>
    </div>
  )
}
