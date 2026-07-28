// Extraído de AG4TeacherAgendaPage.tsx (BEAC-2095, story BEAC-2051) para ser
// reaproveitado por D2Dashboard.tsx sem duplicar a janela de check-in.
//
// Janela de check-in duplicada do backend (rallye-api/api/internal/bookings/
// attendance_handler.go:123-126, isWithinCheckinWindow/checkinWindowBefore/
// checkinWindowAfter — funções/constantes privadas do pacote Go, não
// exportáveis sem mudar sua visibilidade). Usada SÓ para decidir o estado
// visual (3 estados) — a submissão real de check-in continua validada e
// registrada pelo backend (POST .../attendance, que já devolve `retroactive`
// quando fora da janela), então uma divergência de relógio entre
// cliente/servidor no pior caso só mostra o botão certo um pouco cedo/tarde,
// nunca aceita um check-in inválido.
import type { Booking } from '../api/bookings'

export const CHECKIN_WINDOW_BEFORE_MS = 15 * 60 * 1000
export const CHECKIN_WINDOW_AFTER_MS = 30 * 60 * 1000

export function isWithinCheckinWindow(now: Date, startAtIso: string): boolean {
  const start = new Date(startAtIso).getTime()
  const n = now.getTime()
  return n >= start - CHECKIN_WINDOW_BEFORE_MS && n <= start + CHECKIN_WINDOW_AFTER_MS
}

export type RowState = 'available' | 'future' | 'done'

/**
 * Estado de linha (3 estados do doc de AG4). Para aula PASSADA, fora da
 * janela, sem check-in feito — decisão original de AG4TeacherAgendaPage.tsx
 * (preservada na extração): trata como 'available' em vez de inventar um 4º
 * estado visual, já que o backend aceita check-in retroativo depois da
 * janela (mesmo endpoint, devolve `retroactive: true`).
 */
export function rowState(now: Date, booking: Pick<Booking, 'checkedIn' | 'startAt'>): RowState {
  if (booking.checkedIn) return 'done'
  if (isWithinCheckinWindow(now, booking.startAt)) return 'available'
  if (now.getTime() < new Date(booking.startAt).getTime()) return 'future'
  return 'available'
}
