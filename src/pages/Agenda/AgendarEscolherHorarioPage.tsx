import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { Chip } from '../../components/ui/Chip/Chip'
import { Button } from '../../components/ui/Button/Button'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { listClassOccurrences, type ClassOccurrence } from '../../lib/api/classOccurrences'
import { listCourts } from '../../lib/api/courts'
import { listTeachers } from '../../lib/api/teachers'
import {
  AGENDAR_SPORTS,
  buildAgendarDateStrip,
  formatPriceCents,
  type AgendarDateOption,
  type AgendarSelection,
} from './agendarMockData'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './AgendarFlow.css'

function occurrenceKey(o: ClassOccurrence): string {
  return `${o.classId}__${o.startAt}`
}

function occurrenceTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Tela 1/3 do fluxo self-service "Agendar aula" (Aluno) — Figma "06 · Agendar
 * — Escolher Horário — Aluno — Mobile" (node 159:1576) / "— Desktop" (node
 * 183:2954). Construída do zero (não é reskin — a versão staff de "Nova
 * reserva" é `NovaReservaSheet.tsx`, um bottom sheet completamente diferente
 * de fluxo/permissão, ver comentário daquele arquivo).
 *
 * Integrada com o backend real (dispatch de disponibilidade self-service):
 * GET /units/{id}/classes/occurrences?sport=&from=&to= (../../lib/api/classOccurrences.ts)
 * — já só devolve ocorrências futuras COM vaga, então o filtro "spotsTaken >=
 * spotsTotal" que existia no mock não é mais necessário aqui.
 *
 * `price_cents` pode vir `null` (turma sem preço configurado ainda no
 * backend) — decisão desta implementação: ocultar essas ocorrências da lista
 * de agendamento self-service (não faz sentido vender/agendar algo sem
 * preço, e o passo de Confirmar mostra "Total a pagar" com base nesse
 * valor). Alternativa descartada: mostrar "Preço a definir" com o slot
 * desabilitado — mais complexidade de UI para um caso que o backend já pode
 * evitar simplesmente configurando o preço da turma.
 *
 * `court_id`/`teacher_id` vêm só como UUID na resposta de occurrences — para
 * mostrar nome de quadra/professor no resumo de Confirmar (Card com as
 * mesmas linhas do Figma), esta tela busca `GET /units/{id}/courts` e
 * `GET /units/{id}/teachers` uma vez (paralelo à busca de ocorrências) e
 * resolve os nomes ao montar a seleção — mesmo padrão de enriquecimento
 * client-side já usado noutras telas do módulo (ex.: AG4TeacherAgendaPage).
 */
export default function AgendarEscolherHorarioPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()

  const [sport, setSport] = useState(AGENDAR_SPORTS[0]?.slug ?? 'beach_tennis')
  const dateStrip = useMemo(() => buildAgendarDateStrip(new Date()), [])
  const [dateIso, setDateIso] = useState(dateStrip[0]?.iso)
  const [occurrenceKeySelected, setOccurrenceKeySelected] = useState<string | undefined>(undefined)

  const [occurrences, setOccurrences] = useState<ClassOccurrence[]>([])
  const [courtNames, setCourtNames] = useState<Map<string, string>>(new Map())
  const [teacherNames, setTeacherNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!unitId) return
    let cancelled = false
    listCourts(unitId).then((result) => {
      if (cancelled || !result.ok) return
      setCourtNames(new Map(result.courts.map((c) => [c.id, c.name])))
    })
    listTeachers(unitId).then((result) => {
      if (cancelled || !result.ok) return
      setTeacherNames(new Map(result.teachers.map((t) => [t.id, t.fullName])))
    })
    return () => {
      cancelled = true
    }
  }, [unitId])

  useEffect(() => {
    if (!unitId || !dateIso) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const from = `${dateIso}T00:00:00-03:00`
    const to = `${dateIso}T23:59:59-03:00`
    listClassOccurrences(unitId, sport, from, to).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setError(result.message ?? 'Não foi possível carregar os horários disponíveis.')
        setOccurrences([])
        return
      }
      // price_cents null = turma sem preço configurado — ver comentário de
      // pacote acima.
      const withPrice = result.occurrences.filter((o) => o.priceCents !== null)
      setOccurrences(withPrice)
      setOccurrenceKeySelected(withPrice[0] ? occurrenceKey(withPrice[0]) : undefined)
    })
    return () => {
      cancelled = true
    }
  }, [unitId, sport, dateIso])

  if (!unitId) return null

  const selectedDate: AgendarDateOption | undefined = dateStrip.find((d) => d.iso === dateIso)
  const selectedOccurrence = occurrences.find((o) => occurrenceKey(o) === occurrenceKeySelected)

  function handleContinue() {
    if (!selectedOccurrence || !unitId) return
    const selection: AgendarSelection = {
      unitId,
      unitName: orgLabel || 'sua arena',
      occurrence: selectedOccurrence,
      courtName: courtNames.get(selectedOccurrence.courtId) ?? 'Quadra',
      teacherName: teacherNames.get(selectedOccurrence.teacherId) ?? 'A definir',
    }
    navigate(`/units/${unitId}/agenda/agendar/confirmar`, { state: { selection } })
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="agendar-body">
        <Link className="agendar-back" to={`/units/${unitId}/agenda/minha`}>
          ‹ Voltar
        </Link>

        <div className="agendar-header">
          <h1>Agendar aula</h1>
          <p>{orgLabel || 'Sua arena'} · escolha o esporte, o dia e o horário</p>
        </div>

        <div className="agendar-sport-chips" role="group" aria-label="Esporte">
          {AGENDAR_SPORTS.map((s) => (
            <Chip key={s.slug} label={s.label} selected={sport === s.slug} onToggle={() => setSport(s.slug)} />
          ))}
        </div>

        <div>
          <p className="agendar-section-label">Data</p>
          <div className="agendar-date-strip" role="group" aria-label="Dia">
            {dateStrip.map((d) => (
              <button
                key={d.iso}
                type="button"
                className={`agendar-date-chip${dateIso === d.iso ? ' agendar-date-chip--selected' : ''}`}
                aria-pressed={dateIso === d.iso}
                onClick={() => setDateIso(d.iso)}
              >
                <span className="agendar-date-chip__weekday">{d.weekdayShort}</span>
                <span className="agendar-date-chip__day">{d.day}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="agendar-section-label">
            Horários disponíveis
            {selectedDate ? ` · ${selectedDate.weekdayShort}, ${selectedDate.day} ${selectedDate.monthShort}` : ''}
          </p>

          {error ? (
            <AlertCard tone="danger" showIcon>
              {error}
            </AlertCard>
          ) : loading ? (
            <PageLoading label="Carregando horários" variant="section" />
          ) : occurrences.length === 0 ? (
            <p className="agendar-hint">Nenhum horário disponível para esse esporte/dia.</p>
          ) : (
            <div className="agendar-slots-grid">
              {occurrences.map((o) => {
                const key = occurrenceKey(o)
                const selected = occurrenceKeySelected === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`agendar-slot${selected ? ' agendar-slot--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setOccurrenceKeySelected(key)}
                  >
                    <span className="agendar-slot__time">{occurrenceTime(o.startAt)}</span>
                    <span className="agendar-slot__price">{formatPriceCents(o.priceCents as number)}</span>
                    <span className="agendar-slot__spots">
                      {o.availableSeats} de {o.capacity} vagas
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <p className="agendar-hint">
          Só mostramos horários com vaga. Preço já incluso — sem surpresa na hora de pagar.
        </p>

        <Button variant="primary" size="lg" fullWidth disabled={!selectedOccurrence} onClick={handleContinue}>
          {selectedOccurrence
            ? `Continuar · ${occurrenceTime(selectedOccurrence.startAt)} · ${formatPriceCents(selectedOccurrence.priceCents as number)}`
            : 'Continuar'}
        </Button>
      </div>
    </AppShell>
  )
}
