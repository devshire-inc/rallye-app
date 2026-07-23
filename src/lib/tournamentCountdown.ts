// Countdown de inscrições para TO1 (BEAC-1984) — dias corridos até
// registration_closes_at, mesmo padrão de daysUntilDue (invoiceStatus.ts):
// `now` injetável em teste. registration_closes_at sempre carrega o offset
// -03:00 explícito (ver toRegistrationClosesAt, TournamentFormPage.tsx) — a
// data de calendário é extraída direto da string (sem reconverter fuso), e
// `now` (instante real, sem offset fixo) é deslocado -3h antes de virar data
// de calendário, pra comparar "o mesmo dia" dos dois lados.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

function closesAtDateNumber(closesAt: string): number {
  const [year, month, day] = closesAt.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function nowDateNumber(now: Date): number {
  const shifted = new Date(now.getTime() - BRT_OFFSET_MS)
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
}

export function daysUntilRegistrationCloses(closesAt: string, now: Date = new Date()): number {
  return Math.round((closesAtDateNumber(closesAt) - nowDateNumber(now)) / (1000 * 60 * 60 * 24))
}

/** Rótulo PT-BR usado na seção "Inscrições abertas" de TO1 (`scr-to1`:
 * "encerra em 5 dias"). `null` quando o torneio não tem
 * registration_closes_at — cabe a quem chama decidir se omite a linha. */
export function registrationCountdownLabel(closesAt: string | null, now: Date = new Date()): string | null {
  if (!closesAt) return null
  const days = daysUntilRegistrationCloses(closesAt, now)
  if (days < 0) return 'inscrições encerradas'
  if (days === 0) return 'encerra hoje'
  if (days === 1) return 'encerra em 1 dia'
  return `encerra em ${days} dias`
}
