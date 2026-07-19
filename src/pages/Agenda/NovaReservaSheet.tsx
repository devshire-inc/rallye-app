import { useEffect, useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { createBooking, type CreateBookingType } from '../../lib/api/bookings'
import { createClass, listClasses, type RallyeClass } from '../../lib/api/classes'
import type { Court } from '../../lib/api/courts'
import '../../components/AuthLayout/AuthLayout.css'
import './NovaReservaSheet.css'

export interface NovaReservaPrefill {
  courtId?: string
  /** Dia a pré-preencher no campo Data (padrão: hoje). */
  date?: Date
  /** Hora de início a pré-preencher (padrão: próxima hora cheia). */
  startHour?: number
}

export interface NovaReservaSheetProps {
  open: boolean
  onClose: () => void
  unitId: string
  courts: Court[]
  prefill?: NovaReservaPrefill
  /** Chamado depois de uma criação bem-sucedida (Turma nova ou
   * Particular/Avulsa/Bloqueio) — quem usa este sheet (AG1DayPage/
   * AG2WeekPage) reusa isso para re-buscar o grid. */
  onCreated: () => void
}

type ReservaType = 'turma' | 'particular' | 'avulsa' | 'bloqueio'

const TYPE_PILLS: { value: ReservaType; label: string }[] = [
  { value: 'turma', label: 'Turma' },
  { value: 'particular', label: 'Particular' },
  { value: 'avulsa', label: 'Avulsa' },
  { value: 'bloqueio', label: 'Bloqueio' },
]

type Recorrencia = 'unica' | 'semanal' | 'personalizado'

const BLOQUEIO_MOTIVOS = ['Manutenção', 'Evento', 'Outro']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDateInputValue(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Faz o parse de "dd/mm/aaaa" — retorna null se malformado (validação
 * mínima; o AC não pede um date-picker de verdade, o protótipo real também
 * usa um <input> de texto livre para a data, ver #ag6d). */
function parseDateInputValue(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  return { day, month: month - 1, year }
}

function combineToISO(dateValue: string, timeValue: string): string | null {
  const d = parseDateInputValue(dateValue)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue.trim())
  if (!d || !timeMatch) return null
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  return new Date(d.year, d.month, d.day, hour, minute).toISOString()
}

/** BYDAY RFC5545 de um Date local, ex.: segunda -> "MO". */
function bydayOf(date: Date): string {
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][date.getDay()]
}

/**
 * AG6 — bottom sheet "Nova reserva" (BEAC-1904, story BEAC-1704). Cópia
 * exata dos 4 type-pills de `#ag6Types` no protótipo real (Artifact "Rallye
 * — Agenda", scr salvo em tool-results/artifact-*.html): Turma / Particular /
 * Avulsa / Bloqueio.
 *
 * Contrato de backend por tipo (ver relatório de dispatch para o detalhamento
 * completo):
 *   - Turma: só "+ Criar nova turma" chama um endpoint real (POST
 *     /units/{id}/classes, já existente antes deste dispatch) — a
 *     materialização da primeira ocorrência é lazy, automática na próxima
 *     leitura do grid (BEAC-1898), então este componente não chama mais nada
 *     depois do POST. Selecionar uma turma EXISTENTE no dropdown não tem
 *     ação de backend correspondente (não existe endpoint para "adicionar
 *     uma ocorrência avulsa a uma turma já existente neste horário/quadra") —
 *     mostra um estado "ainda não disponível" nesse caso, em vez de inventar
 *     uma chamada.
 *   - Particular/Avulsa/Bloqueio: POST /units/{id}/bookings — endpoint NOVO,
 *     adicionado como parte deste mesmo dispatch (não existia nenhum POST de
 *     bookings antes; só GET /units/{id}/bookings e POST /units/{id}/classes
 *     existiam) — ver ../../lib/api/bookings.ts.
 *
 * GAP CONHECIDO — sem diretório de professores/alunos: não existe (em
 * nenhuma story anterior) um GET /units/{id}/teachers (lista/busca) nem um
 * GET /units/{id}/students (lista/busca) — só GET /units/{id}/students/{id}
 * (por id já conhecido). Os campos "Professor" (Turma nova + Particular) e
 * "Aluno" (Particular) portanto NÃO podem ser um <select>/autocomplete real
 * — ficam como inputs de texto livre para o UUID (teacher_id/student_id),
 * com hint explicando a limitação. Funcional (a chamada de API é real, com um
 * UUID válido), mas não é a UX pretendida pelo AC ("seletor de turma
 * existente", "seletor de professor + busca de aluno") — reportado como
 * questão em aberto no relatório de dispatch, não resolvido silenciosamente.
 */
/**
 * O reset de formulário a cada abertura (AC comum de AG1/AG2:
 * "pré-preenchido com quadra/horário quando aplicável") é feito via
 * inicializador preguiçoso de useState, não via um `useEffect` que chama
 * setState no corpo (proibido pelo lint react-hooks/set-state-in-effect,
 * mesmo gotcha documentado em StudentProfilePage.tsx/RolesPage) — quem usa
 * este sheet (AG1DayPage/AG2WeekPage) precisa passar uma `key` que muda a
 * cada abertura (ex.: um contador incrementado no clique do FAB/slot) para
 * forçar um remount e, com ele, um estado inicial fresco a partir do
 * `prefill` atual.
 */
function initialStartHour(prefill?: NovaReservaPrefill): number {
  return prefill?.startHour ?? new Date().getHours() + 1
}

export function NovaReservaSheet({
  open,
  onClose,
  unitId,
  courts,
  prefill,
  onCreated,
}: NovaReservaSheetProps) {
  const [type, setType] = useState<ReservaType>('turma')

  const [courtId, setCourtId] = useState(() => prefill?.courtId ?? courts[0]?.id ?? '')
  const [dateValue, setDateValue] = useState(() => formatDateInputValue(prefill?.date ?? new Date()))
  const [startTime, setStartTime] = useState(() => `${pad2(initialStartHour(prefill))}:00`)
  const [endTime, setEndTime] = useState(() => `${pad2(initialStartHour(prefill) + 1)}:00`)

  // Turma
  const [existingClasses, setExistingClasses] = useState<RallyeClass[]>([])
  const [classSelection, setClassSelection] = useState<'new' | string>('new')
  const [newClassName, setNewClassName] = useState('')
  const [newClassTeacherId, setNewClassTeacherId] = useState('')
  const [newClassCapacity, setNewClassCapacity] = useState('8')
  const [newClassLevel, setNewClassLevel] = useState('')
  const [recorrencia, setRecorrencia] = useState<Recorrencia>('semanal')
  const [customRRule, setCustomRRule] = useState('')

  // Particular
  const [privateTeacherId, setPrivateTeacherId] = useState('')
  const [privateStudentId, setPrivateStudentId] = useState('')

  // Avulsa
  const [responsibleName, setResponsibleName] = useState('')
  const [observations, setObservations] = useState('')

  // Bloqueio
  const [blockReason, setBlockReason] = useState(BLOQUEIO_MOTIVOS[0])
  const [blockEndDate, setBlockEndDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success' | 'unavailable'; text: string } | null>(
    null,
  )

  // Carrega turmas existentes só quando o tipo Turma está ativo (mesmo
  // espírito de StudentProfilePage: não busca o que a UI não vai mostrar).
  useEffect(() => {
    if (!open || type !== 'turma') return
    let cancelled = false
    listClasses(unitId).then((result) => {
      if (cancelled) return
      if (result.ok) setExistingClasses(result.classes.filter((c) => c.status === 'active'))
    })
    return () => {
      cancelled = true
    }
  }, [open, type, unitId])

  if (!open) return null

  async function handleCreate() {
    setMessage(null)

    if (type === 'turma' && classSelection !== 'new') {
      // Ver comentário de módulo: nenhum endpoint existe para isso.
      setMessage({
        kind: 'unavailable',
        text: 'Adicionar uma reserva a uma turma já existente ainda não está disponível — só a criação de turma nova está implementada nesta versão.',
      })
      return
    }

    setSubmitting(true)
    try {
      if (type === 'turma') {
        const court = courts.find((c) => c.id === courtId)
        if (!court) {
          setMessage({ kind: 'error', text: 'Selecione uma quadra válida.' })
          return
        }
        if (!newClassName.trim() || !newClassTeacherId.trim()) {
          setMessage({ kind: 'error', text: 'Nome da turma e professor são obrigatórios.' })
          return
        }
        const parsedDate = parseDateInputValue(dateValue)
        if (!parsedDate) {
          setMessage({ kind: 'error', text: 'Data inválida (use dd/mm/aaaa).' })
          return
        }
        const anchor = new Date(parsedDate.year, parsedDate.month, parsedDate.day)
        const rrule =
          recorrencia === 'unica'
            ? `FREQ=WEEKLY;COUNT=1`
            : recorrencia === 'semanal'
              ? `FREQ=WEEKLY;BYDAY=${bydayOf(anchor)};COUNT=12`
              : customRRule.trim()
        if (!rrule) {
          setMessage({ kind: 'error', text: 'Informe a regra de recorrência personalizada (RRULE).' })
          return
        }
        const result = await createClass(unitId, {
          teacherId: newClassTeacherId.trim(),
          sport: court.sport,
          name: newClassName.trim(),
          courtId: court.id,
          rrule,
          startTime,
          endTime,
          capacity: Number(newClassCapacity) || 1,
          level: newClassLevel.trim() || undefined,
        })
        if (!result.ok) {
          setMessage({ kind: 'error', text: result.message ?? `Não foi possível criar a turma (${result.error}).` })
          return
        }
        setMessage({ kind: 'success', text: 'Turma criada! O calendário será atualizado.' })
        onCreated()
        setTimeout(onClose, 1100)
        return
      }

      // Particular / Avulsa / Bloqueio -> POST /units/{id}/bookings.
      let bookingType: CreateBookingType
      let startAt: string | null
      let endAt: string | null
      const payloadExtra: {
        teacherId?: string
        studentId?: string
        responsibleName?: string
        reason?: string
      } = {}

      if (type === 'particular') {
        bookingType = 'private'
        startAt = combineToISO(dateValue, startTime)
        endAt = combineToISO(dateValue, endTime)
        if (!privateTeacherId.trim() || !privateStudentId.trim()) {
          setMessage({ kind: 'error', text: 'Professor e aluno são obrigatórios.' })
          return
        }
        payloadExtra.teacherId = privateTeacherId.trim()
        payloadExtra.studentId = privateStudentId.trim()
      } else if (type === 'avulsa') {
        bookingType = 'adhoc'
        startAt = combineToISO(dateValue, startTime)
        endAt = combineToISO(dateValue, endTime)
        if (!responsibleName.trim()) {
          setMessage({ kind: 'error', text: 'Nome do responsável é obrigatório.' })
          return
        }
        payloadExtra.responsibleName = responsibleName.trim()
        if (observations.trim()) payloadExtra.reason = observations.trim()
      } else {
        bookingType = 'block'
        startAt = combineToISO(dateValue, startTime)
        endAt = combineToISO(blockEndDate || dateValue, endTime)
        payloadExtra.reason = blockReason
      }

      if (!courtId) {
        setMessage({ kind: 'error', text: 'Selecione uma quadra válida.' })
        return
      }
      if (!startAt || !endAt) {
        setMessage({ kind: 'error', text: 'Data/horário inválidos.' })
        return
      }

      const result = await createBooking(unitId, {
        type: bookingType,
        courtId,
        startAt,
        endAt,
        ...payloadExtra,
      })
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.message ?? `Não foi possível criar a reserva (${result.error}).` })
        return
      }
      setMessage({ kind: 'success', text: 'Reserva criada! O calendário foi atualizado.' })
      onCreated()
      setTimeout(onClose, 1100)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Nova reserva">
      <button className="iconbtn sclose" type="button" aria-label="Fechar" onClick={onClose}>
        ×
      </button>
      <h2>Nova reserva</h2>
      <p className="ssub">Os campos mudam conforme o tipo.</p>
      <div className="stack">
        <div className="type-pills" role="group" aria-label="Tipo de reserva">
          {TYPE_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              className="chip"
              aria-pressed={type === pill.value}
              onClick={() => setType(pill.value)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="ag6-grid2">
          <div className="field">
            <label htmlFor="ag6q">Quadra</label>
            <select id="ag6q" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name} · {court.sport}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ag6d">Data</label>
            <input id="ag6d" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ag6h1">Início</label>
            <input id="ag6h1" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ag6h2">Fim</label>
            <input id="ag6h2" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        {type === 'turma' ? (
          <div className="fgroup on">
            <div className="field">
              <label htmlFor="ag6turma">Turma</label>
              <select
                id="ag6turma"
                value={classSelection}
                onChange={(e) => setClassSelection(e.target.value)}
              >
                <option value="new">+ Criar nova turma</option>
                {existingClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {classSelection === 'new' ? (
              <>
                <div className="field">
                  <label htmlFor="ag6turma-nome">Nome da turma</label>
                  <input
                    id="ag6turma-nome"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ag6turma-prof">Professor (ID)</label>
                  <input
                    id="ag6turma-prof"
                    value={newClassTeacherId}
                    onChange={(e) => setNewClassTeacherId(e.target.value)}
                    placeholder="UUID do professor"
                  />
                  <span className="hint">
                    Sem diretório de professores disponível ainda — cole o ID (ver questão em aberto do
                    dispatch).
                  </span>
                </div>
                <div className="ag6-grid2">
                  <div className="field">
                    <label htmlFor="ag6turma-cap">Capacidade</label>
                    <input
                      id="ag6turma-cap"
                      type="number"
                      min={1}
                      value={newClassCapacity}
                      onChange={(e) => setNewClassCapacity(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ag6turma-nivel">Nível (opcional)</label>
                    <input
                      id="ag6turma-nivel"
                      value={newClassLevel}
                      onChange={(e) => setNewClassLevel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Recorrência</label>
                  <div className="type-pills">
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={recorrencia === 'unica'}
                      onClick={() => setRecorrencia('unica')}
                    >
                      Única
                    </button>
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={recorrencia === 'semanal'}
                      onClick={() => setRecorrencia('semanal')}
                    >
                      Semanal
                    </button>
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={recorrencia === 'personalizado'}
                      onClick={() => setRecorrencia('personalizado')}
                    >
                      Personalizado
                    </button>
                  </div>
                  <div className="hint">Semanal cria as próximas 12 semanas.</div>
                  {recorrencia === 'personalizado' ? (
                    <input
                      aria-label="RRULE personalizado"
                      placeholder="Ex.: FREQ=WEEKLY;BYDAY=TU,TH;COUNT=8"
                      value={customRRule}
                      onChange={(e) => setCustomRRule(e.target.value)}
                    />
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {type === 'particular' ? (
          <div className="fgroup on">
            <div className="field">
              <label htmlFor="ag6prof">Professor (ID)</label>
              <input
                id="ag6prof"
                value={privateTeacherId}
                onChange={(e) => setPrivateTeacherId(e.target.value)}
                placeholder="UUID do professor"
              />
            </div>
            <div className="field">
              <label htmlFor="ag6al">Aluno (ID)</label>
              <input
                id="ag6al"
                value={privateStudentId}
                onChange={(e) => setPrivateStudentId(e.target.value)}
                placeholder="Buscar aluno... (UUID, sem diretório ainda)"
              />
            </div>
          </div>
        ) : null}

        {type === 'avulsa' ? (
          <div className="fgroup on">
            <div className="field">
              <label htmlFor="ag6resp">Responsável</label>
              <input
                id="ag6resp"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Nome de quem reservou"
              />
            </div>
            <div className="field">
              <label htmlFor="ag6obs">Observações</label>
              <textarea
                id="ag6obs"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        ) : null}

        {type === 'bloqueio' ? (
          <div className="fgroup on">
            <div className="field">
              <label htmlFor="ag6mot">Motivo</label>
              <select id="ag6mot" value={blockReason} onChange={(e) => setBlockReason(e.target.value)}>
                {BLOQUEIO_MOTIVOS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ag6fim">Até (data fim)</label>
              <input
                id="ag6fim"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
                placeholder={dateValue}
              />
            </div>
            <div className="hint block-hint">
              Bloqueio não verifica nem cancela reservas existentes automaticamente — confirme que a
              quadra está livre no período antes de criar.
            </div>
          </div>
        ) : null}

        {message ? (
          <div
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`toast toast-${message.kind === 'success' ? 'success' : message.kind === 'unavailable' ? 'neutral' : 'error'}`}
          >
            {message.text}
          </div>
        ) : null}

        <button
          className="btn btn-primary btn-md btn-full"
          type="button"
          disabled={submitting}
          onClick={handleCreate}
        >
          {submitting ? 'Criando…' : 'Criar reserva'}
        </button>
      </div>
    </BottomSheet>
  )
}
