import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Chip } from '../../components/ui/Chip/Chip'
import { Icon } from '../../components/ui/Icon/Icon'
import { Input } from '../../components/ui/Input/Input'
import { Segmented } from '../../components/ui/Segmented/Segmented'
import { Select } from '../../components/ui/Select/Select'
import { createBooking, type CreateBookingType } from '../../lib/api/bookings'
import { createClass, listClasses, type RallyeClass } from '../../lib/api/classes'
import { listCourts, type Court } from '../../lib/api/courts'
import { courtSportCssVar, formatDateInput, formatISODate } from './agendaShared'
import './AG6NovaReservaPage.css'

/**
 * AG6 — Nova reserva (BEAC-1904, story BEAC-1704), reskinada em 2026-08
 * contra os frames "08 · Nova Reserva — Admin — Mobile" (12:280) e
 * "08 · Nova Reserva — Admin — Desktop" (94:1656) do protótipo
 * hb7PA0Xx3L7iHjt9AfHsGK.
 *
 * ERA UM BOTTOM SHEET (`NovaReservaSheet.tsx`), VIROU PÁGINA — decisão do
 * dono do produto, não do reskin. Os dois frames desenham uma PÁGINA: seta de
 * voltar + título no mobile, breadcrumb "Agenda › Nova Reserva" no desktop,
 * fundo limpo (nenhuma agenda por trás) e a bottom nav visível. Um sheet
 * cobriria o calendário e não tem nem endereço nem botão-voltar do sistema.
 *
 * O QUE MUDOU DE VERDADE (navegação), e o que NÃO mudou:
 *   - Nada da lógica de criação mudou: mesma validação, mesmas chamadas
 *     (`createClass` / `createBooking`), mesmo tratamento do caso "turma
 *     existente" sem endpoint. É a mesma lógica noutra casca.
 *   - `courts` deixou de chegar por prop: uma página montada por rota busca o
 *     que precisa (`listCourts`), como qualquer outra rota unit-scoped.
 *   - `onCreated` (re-buscar o grid) deixou de existir como prop e não virou
 *     nada: AG1/AG2 são rotas IRMÃS desta, então navegar para cá as
 *     DESMONTA; ao voltar elas remontam e o `useEffect` de `reloadBookings`
 *     roda de novo. O grid chega atualizado sem callback nenhum.
 *   - O contador `sheetKey` dos dois chamadores ("forçar remount para o
 *     formulário resetar") sumiu junto: uma página montada por rota já nasce
 *     com estado fresco, que era exatamente o que a `key` simulava.
 *
 * PREENCHIMENTO AUTOMÁTICO VIA QUERY PARAMS, não `location.state`: tocar num
 * horário livre da agenda continua trazendo quadra/data/hora prontos, só que
 * agora pelo ENDEREÇO — `?court=&date=&hour=`. Foi a escolha deliberada
 * (o brief pedia justificar a alternativa): com `state` o link não sobrevive
 * a um F5 nem pode ser mandado pra alguém, e metade do ganho de virar página
 * é justamente ter um endereço de verdade. Precedente do lado oposto:
 * AG5BookingDetailPage usa `state` porque carrega um OBJETO Booking inteiro
 * que não tem endpoint de leitura por id — aqui são três escalares.
 *
 * A VOLTA — `?from=` + `?fromDate=`: cancelar, criar ou tocar em "‹ Voltar"
 * devolve o usuário para onde ele estava, na visão certa (`from=dia|semana`)
 * e no dia/semana certos (`fromDate`, ISO local). Sem esses dois a volta cai
 * no destino padrão `/units/:unitId/agenda` (hoje, visão Dia) — é o que
 * acontece num deep link direto, e é a única opção honesta ali: não há de
 * onde inferir a origem. `fromDate` é separado de `date` de propósito: o FAB
 * da semana (AG2) NÃO pré-preenche data nenhuma, mas ainda assim precisa
 * voltar para a semana que o usuário estava vendo.
 *
 * Contrato de backend por tipo (inalterado, herdado do sheet):
 *   - Turma: só "+ Criar nova turma" chama um endpoint real (POST
 *     /units/{id}/classes) — a materialização da primeira ocorrência é lazy,
 *     automática na próxima leitura do grid (BEAC-1898). Selecionar uma turma
 *     EXISTENTE não tem ação de backend correspondente (não existe endpoint
 *     para "adicionar uma ocorrência avulsa a uma turma já existente neste
 *     horário/quadra") — mostra um estado "ainda não disponível" nesse caso,
 *     em vez de inventar uma chamada.
 *   - Particular/Avulsa/Bloqueio: POST /units/{id}/bookings.
 *
 * GAP CONHECIDO — sem diretório de professores/alunos: não existe GET
 * /units/{id}/teachers nem GET /units/{id}/students (lista/busca), só
 * GET /units/{id}/students/{id} (por id já conhecido). Os campos "Professor"
 * e "Aluno" portanto NÃO podem ser o combo/autocomplete que os frames
 * desenham (12:280 mostra "Ana Reis ▾", 94:1656 mostra uma busca 🔍) — ficam
 * como `Input` de texto livre para o UUID, com `helper` explicando a
 * limitação. É a mesma questão em aberto que o sheet já carregava; a casca
 * nova não a resolve.
 *
 * DESVIOS DELIBERADOS DOS FRAMES:
 *   - Rótulo do tipo: o frame escreve "Avulsa (day use)". Aqui continua
 *     "Avulsa". Day Use é OUTRO domínio deste app (rotas /day-use/*, tabela e
 *     endpoints próprios, POST /units/{id}/day-use-bookings) — o "Avulsa"
 *     desta tela é um booking `adhoc` comum. Adotar a copy do frame apontaria
 *     o admin para o fluxo errado.
 *   - "Aluno" com estado de erro e "Selecione um aluno" desenhados no frame
 *     de desktop são o retrato de um estado de validação, não um campo
 *     sempre-vermelho: a validação real acontece no submit e continua
 *     aparecendo no aviso inline (mesma regra de antes).
 *   - O frame não desenha os campos de Turma/Avulsa/Bloqueio (retrata só o
 *     tipo Particular). Esses blocos herdam a gramática do frame (rótulo
 *     `Label`, campo de 46px, chips pill) sem ter um desenho próprio pra
 *     copiar.
 */

type ReservaType = 'turma' | 'particular' | 'avulsa' | 'bloqueio'

/** Ordem dos chips igual à do frame (12:280 / 94:1656): Particular primeiro. */
const TYPE_CHIPS: { value: ReservaType; label: string; description: string }[] = [
  {
    value: 'particular',
    label: 'Particular',
    // Copy literal do frame (nós 21:397 / 94:1115).
    description: 'Aula individual com professor e aluno.',
  },
  {
    value: 'avulsa',
    label: 'Avulsa',
    description: 'Reserva pontual da quadra, no nome de um responsável.',
  },
  { value: 'turma', label: 'Turma', description: 'Turma recorrente com professor, capacidade e nível.' },
  { value: 'bloqueio', label: 'Bloqueio', description: 'Fecha a quadra no período (manutenção, evento).' },
]

type Recorrencia = 'unica' | 'semanal' | 'personalizado'

const RECORRENCIA_OPTIONS: { value: Recorrencia; label: string }[] = [
  { value: 'unica', label: 'Única' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'personalizado', label: 'Personalizado' },
]

const BLOQUEIO_MOTIVOS = ['Manutenção', 'Evento', 'Outro']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Faz o parse de "dd/mm/aaaa" — retorna null se malformado (validação
 * mínima; o AC não pede um date-picker de verdade, o protótipo real também
 * usa um campo de texto livre para a data). */
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

/** "2026-08-10" -> Date local. Mesma idiomática de AG1DayPage/AG2WeekPage
 * (`new Date(`${iso}T00:00:00`)`), que evita o shift de fuso do
 * `new Date('2026-08-10')` puro (interpretado como UTC). */
function parseISODateParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseHourParam(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const hour = Number(value)
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null
}

export default function AG6NovaReservaPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Lidos UMA vez, no mount. A página é montada por rota, então "abrir a tela
  // de novo" já é um mount novo — é isto que substitui o `key={sheetKey}` que
  // AG1/AG2 mantinham para forçar o remount do sheet.
  const prefillCourtId = searchParams.get('court') ?? ''
  const prefillDate = parseISODateParam(searchParams.get('date'))
  const prefillHour = parseHourParam(searchParams.get('hour'))

  const backTo = useMemo(() => {
    const fromDate = parseISODateParam(searchParams.get('fromDate'))
    const query = fromDate ? `?date=${formatISODate(fromDate)}` : ''
    return searchParams.get('from') === 'semana'
      ? `/units/${unitId}/agenda/semana${query}`
      : `/units/${unitId}/agenda${query}`
  }, [searchParams, unitId])

  const [courts, setCourts] = useState<Court[]>([])
  const [type, setType] = useState<ReservaType>('turma')

  const startHour = prefillHour ?? new Date().getHours() + 1
  const [courtId, setCourtId] = useState(prefillCourtId)
  const [dateValue, setDateValue] = useState(() => formatDateInput(prefillDate ?? new Date()))
  const [startTime, setStartTime] = useState(`${pad2(startHour)}:00`)
  const [endTime, setEndTime] = useState(`${pad2(startHour + 1)}:00`)

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

  useEffect(() => {
    if (!unitId) return
    let cancelled = false
    listCourts(unitId).then((result) => {
      if (cancelled || !result.ok) return
      setCourts(result.courts)
      // `?court=` manda; sem ele cai na primeira quadra da unit — mesmo
      // default do sheet (`prefill?.courtId ?? courts[0]?.id`), só que agora
      // as quadras chegam depois do primeiro render.
      setCourtId((prev) => prev || result.courts[0]?.id || '')
    })
    return () => {
      cancelled = true
    }
  }, [unitId])

  // Carrega turmas existentes só quando o tipo Turma está ativo (mesmo
  // espírito de StudentProfilePage: não busca o que a UI não vai mostrar).
  useEffect(() => {
    if (!unitId || type !== 'turma') return
    let cancelled = false
    listClasses(unitId).then((result) => {
      if (cancelled) return
      if (result.ok) setExistingClasses(result.classes.filter((c) => c.status === 'active'))
    })
    return () => {
      cancelled = true
    }
  }, [type, unitId])

  // A volta depois do sucesso é adiada (1100ms) para o aviso "Reserva criada!"
  // ser lido — o sheet fazia o mesmo antes de se fechar. O timer precisa ser
  // cancelado no desmonte: sem isso, sair da tela na janela do timeout
  // dispararia um `navigate` de um componente que já não está montado.
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current)
    },
    [],
  )

  const goBack = useCallback(() => navigate(backTo), [navigate, backTo])

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
        const result = await createClass(unitId!, {
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
        successTimer.current = setTimeout(goBack, 1100)
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

      const result = await createBooking(unitId!, {
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
      successTimer.current = setTimeout(goBack, 1100)
    } finally {
      setSubmitting(false)
    }
  }

  const typeDescription = TYPE_CHIPS.find((chip) => chip.value === type)?.description

  return (
    <div className="nr-page">
      {/* "‹ Voltar" (frame mobile 21:384/21:385) e breadcrumb (frame desktop
          123:2307) convivem no DOM; quem escolhe é a @media do CSS, no mesmo
          breakpoint da sidebar do shell — mesmo mecanismo de
          AG5BookingDetailPage. */}
      <div className="nr-head">
        <Link className="nr-back" to={backTo}>
          ‹ Voltar
        </Link>
        <nav className="nr-crumbs" aria-label="Trilha de navegação">
          <Link className="nr-crumbs__link" to={backTo}>
            Agenda
          </Link>
          <Icon name="chevron-right" size={12} />
          <span className="nr-crumbs__current">Nova reserva</span>
        </nav>
      </div>

      <h1 className="nr-title">Nova reserva</h1>

      <div className="nr-form">
        <p className="nr-group-label" id="nr-tipo-label">
          Tipo
        </p>
        <div className="nr-chips" role="group" aria-labelledby="nr-tipo-label">
          {TYPE_CHIPS.map((chip) => (
            <Chip
              key={chip.value}
              label={chip.label}
              selected={type === chip.value}
              onToggle={() => setType(chip.value)}
            />
          ))}
        </div>
        <p className="nr-group-hint">{typeDescription}</p>

        <p className="nr-group-label" id="nr-quadra-label">
          Quadra
        </p>
        <div className="nr-chips" role="group" aria-labelledby="nr-quadra-label">
          {courts.map((court) => (
            /* Só o nome da quadra, como os frames escrevem ("Quadra 1"): o
               esporte, que o `<select>` do sheet grudava no rótulo em texto
               (`Q1 · beach_tennis` — o slug cru do banco vazando pra UI), é
               justamente o que o ponto colorido do Chip codifica. */
            <Chip
              key={court.id}
              label={court.name}
              dot
              dotColor={`var(${courtSportCssVar(court)})`}
              selected={courtId === court.id}
              onToggle={() => setCourtId(court.id)}
            />
          ))}
        </div>

        <div className="nr-row3">
          <Input
            id="ag6d"
            label="Data"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            suffix={<Icon name="calendar" size={20} className="nr-field-icon" />}
          />
          <Input
            id="ag6h1"
            label="Início"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            suffix={<Icon name="clock" size={20} className="nr-field-icon" />}
          />
          <Input
            id="ag6h2"
            label="Fim"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            suffix={<Icon name="clock" size={20} className="nr-field-icon" />}
          />
        </div>

        {type === 'turma' ? (
          <div className="nr-group">
            <Select
              id="ag6turma"
              label="Turma"
              value={classSelection}
              onChange={(e) => setClassSelection(e.target.value)}
              options={[
                { value: 'new', label: '+ Criar nova turma' },
                ...existingClasses.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            {classSelection === 'new' ? (
              <>
                <Input
                  id="ag6turma-nome"
                  label="Nome da turma"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                />
                <Input
                  id="ag6turma-prof"
                  label="Professor (ID)"
                  value={newClassTeacherId}
                  onChange={(e) => setNewClassTeacherId(e.target.value)}
                  placeholder="UUID do professor"
                  helper="Sem diretório de professores disponível ainda — cole o ID (ver questão em aberto do dispatch)."
                />
                <div className="nr-row2">
                  <Input
                    id="ag6turma-cap"
                    label="Capacidade"
                    type="number"
                    min={1}
                    value={newClassCapacity}
                    onChange={(e) => setNewClassCapacity(e.target.value)}
                  />
                  <Input
                    id="ag6turma-nivel"
                    label="Nível (opcional)"
                    value={newClassLevel}
                    onChange={(e) => setNewClassLevel(e.target.value)}
                  />
                </div>
                <div className="nr-group">
                  <p className="nr-group-label" id="nr-recorrencia-label">
                    Recorrência
                  </p>
                  <Segmented
                    ariaLabel="Recorrência"
                    options={RECORRENCIA_OPTIONS.map((option) => option.label)}
                    value={RECORRENCIA_OPTIONS.find((option) => option.value === recorrencia)?.label}
                    onChange={(label) => {
                      const option = RECORRENCIA_OPTIONS.find((o) => o.label === label)
                      if (option) setRecorrencia(option.value)
                    }}
                  />
                  <p className="nr-group-hint">Semanal cria as próximas 12 semanas.</p>
                  {recorrencia === 'personalizado' ? (
                    <Input
                      ariaLabel="RRULE personalizado"
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
          <div className="nr-row2">
            <Input
              id="ag6prof"
              label="Professor (ID)"
              value={privateTeacherId}
              onChange={(e) => setPrivateTeacherId(e.target.value)}
              placeholder="UUID do professor"
            />
            <Input
              id="ag6al"
              label="Aluno (ID)"
              value={privateStudentId}
              onChange={(e) => setPrivateStudentId(e.target.value)}
              placeholder="Buscar aluno... (UUID, sem diretório ainda)"
            />
          </div>
        ) : null}

        {type === 'avulsa' ? (
          <div className="nr-group">
            <Input
              id="ag6resp"
              label="Responsável"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Nome de quem reservou"
            />
            {/* Único controle desta tela que NÃO tem componente no design
                system — não existe `ui/Textarea` (conferido em
                src/components/ui). Rótulo e campo replicam a gramática do
                `Input` (mesma altura de linha, mesma borda de 1.5px), com
                classes próprias e prefixadas. */}
            <div className="nr-field">
              <label htmlFor="ag6obs">Observações</label>
              <textarea
                id="ag6obs"
                className="nr-textarea"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        ) : null}

        {type === 'bloqueio' ? (
          <div className="nr-group">
            <Select
              id="ag6mot"
              label="Motivo"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              options={BLOQUEIO_MOTIVOS}
            />
            <Input
              id="ag6fim"
              label="Até (data fim)"
              value={blockEndDate}
              onChange={(e) => setBlockEndDate(e.target.value)}
              placeholder={dateValue}
            />
            <AlertCard tone="warning" showIcon>
              Bloqueio não verifica nem cancela reservas existentes automaticamente — confirme que a
              quadra está livre no período antes de criar.
            </AlertCard>
          </div>
        ) : null}

        {message ? (
          <div
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`nr-notice nr-notice--${message.kind === 'success' ? 'success' : message.kind === 'unavailable' ? 'neutral' : 'error'}`}
          >
            {message.text}
          </div>
        ) : null}
      </div>

      {/* Frame mobile (12:280): só "Criar reserva", cheio — quem cancela é o
          "‹ Voltar" lá em cima. Frame desktop (94:1656): "Cancelar" ghost +
          "Criar reserva" alinhados à direita. Os dois botões estão sempre no
          DOM; a @media do CSS é quem esconde o Cancelar no mobile e tira a
          largura cheia no desktop. */}
      <div className="nr-actions">
        <span className="nr-actions__cancel">
          <Button variant="ghost" onClick={goBack}>
            Cancelar
          </Button>
        </span>
        <Button loading={submitting} onClick={handleCreate}>
          {submitting ? 'Criando…' : 'Criar reserva'}
        </Button>
      </div>
    </div>
  )
}
