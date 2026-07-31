import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { Chip } from '../../components/ui/Chip/Chip'
import { Button } from '../../components/ui/Button/Button'
import {
  AGENDAR_MOCK_SLOTS,
  AGENDAR_SPORTS,
  buildAgendarDateStrip,
  formatPrice,
  isSlotFull,
  type AgendarDateOption,
  type AgendarSelection,
  type AgendarSlotOption,
} from './agendarMockData'
import './AgendarFlow.css'

/**
 * Tela 1/3 do fluxo self-service "Agendar aula" (Aluno) — Figma "06 · Agendar
 * — Escolher Horário — Aluno — Mobile" (node 159:1576) / "— Desktop" (node
 * 183:2954). Constrói do zero (não é reskin — a versão staff de "Nova
 * reserva" é `NovaReservaSheet.tsx`, um bottom sheet completamente diferente
 * de fluxo/permissão, ver comentário daquele arquivo).
 *
 * GAP DE BACKEND (investigado antes de implementar, não presumido):
 *
 *   1. Não existe endpoint de "horários disponíveis" por esporte/quadra/dia
 *      que esta tela possa consumir — só `GET /teachers/{id}/availability`
 *      (../../lib/api/availability.ts), que é a grade de horário de TRABALHO
 *      de um professor específico (56 combinações fixas dia×faixa-de-2h),
 *      não disponibilidade de QUADRA por slot com preço/vagas. Os
 *      chips de esporte, a tira de datas e os slots desta tela usam dados
 *      MOCKADOS estáticos (`./agendarMockData.ts`) só para reproduzir o
 *      Figma — nenhuma chamada de API acontece aqui.
 *
 *   2. Mesmo se o passo de "Confirmar" chamasse `createBooking` (POST
 *      /units/{id}/bookings, ../../lib/api/bookings.ts) de verdade, o role
 *      Aluno não tem a permission `agenda:write` exigida por esse endpoint
 *      (catálogo de módulos em ../../lib/api/permissions.ts; ver também o
 *      comentário de AG5BookingDetailPage.tsx: "Professor tem agenda:write"
 *      — só Professor/Admin têm essa permission na matriz de seed,
 *      migrations/000016). Um Aluno chamando esse endpoint hoje receberia
 *      403 do backend. Por isso o botão "Agendar aula" de
 *      AG3StudentAgendaPage.tsx permanece desabilitado (não foi religado a
 *      este fluxo) e o passo de Confirmar (AgendarConfirmarPage.tsx) NÃO
 *      chama createBooking de verdade — ver comentário daquele arquivo.
 *
 * Estas 3 telas existem para ficarem prontas visualmente (fiéis ao Figma,
 * com os componentes reais do DS) assim que os dois gaps acima forem
 * resolvidos no backend — não para simular uma funcionalidade que não
 * existe.
 */
export default function AgendarEscolherHorarioPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()

  const [sport, setSport] = useState(AGENDAR_SPORTS[0]?.slug ?? 'beach_tennis')
  const dateStrip = useMemo(() => buildAgendarDateStrip(new Date()), [])
  const [dateIso, setDateIso] = useState(dateStrip[0]?.iso)
  const [slotTime, setSlotTime] = useState(AGENDAR_MOCK_SLOTS[0]?.time)

  if (!unitId) return null

  const selectedDate: AgendarDateOption | undefined = dateStrip.find((d) => d.iso === dateIso)
  const selectedSlot: AgendarSlotOption | undefined = AGENDAR_MOCK_SLOTS.find((s) => s.time === slotTime)
  const selectedSportOption = AGENDAR_SPORTS.find((s) => s.slug === sport)

  function handleContinue() {
    if (!selectedDate || !selectedSlot || !selectedSportOption || !unitId) return
    const selection: AgendarSelection = {
      unitId,
      unitName: orgLabel || 'sua arena',
      sport: selectedSportOption.slug,
      sportLabel: selectedSportOption.label,
      date: selectedDate,
      slot: selectedSlot,
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
          <div className="agendar-slots-grid">
            {AGENDAR_MOCK_SLOTS.map((s) => {
              const full = isSlotFull(s)
              const selected = slotTime === s.time
              return (
                <button
                  key={s.time}
                  type="button"
                  className={`agendar-slot${selected ? ' agendar-slot--selected' : ''}${full ? ' agendar-slot--busy' : ''}`}
                  disabled={full}
                  aria-pressed={selected}
                  onClick={() => setSlotTime(s.time)}
                >
                  <span className="agendar-slot__time">{s.time}</span>
                  <span className="agendar-slot__price">{formatPrice(s.priceValue)}</span>
                  <span className="agendar-slot__spots">
                    {s.spotsTaken} de {s.spotsTotal} vagas
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <p className="agendar-hint">
          Só mostramos horários com vaga. Preço já incluso — sem surpresa na hora de pagar.
        </p>

        <Button variant="primary" size="lg" fullWidth disabled={!selectedSlot} onClick={handleContinue}>
          {selectedSlot ? `Continuar · ${selectedSlot.time} · ${formatPrice(selectedSlot.priceValue)}` : 'Continuar'}
        </Button>
      </div>
    </AppShell>
  )
}
