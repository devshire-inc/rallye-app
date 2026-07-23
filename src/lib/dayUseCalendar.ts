// Helpers puros de DU4 (BEAC-1963, story BEAC-1928) — extraídos de
// DayUseQrPage.tsx pra um módulo próprio (react-refresh/only-export-
// components: um arquivo de página só deveria exportar o componente
// default).
import type { DayUseQr } from './api/dayUseFlow'
import { sportLabel } from './sports'

/** "AAAA-MM-DD" + "HH:MM" -> "AAAAMMDDTHHMMSS" (formato de `dates=` do link
 * de template do Google Calendar). SEM sufixo `Z`: o Google Calendar
 * interpreta datas sem `Z` como horário LOCAL (do próprio calendário do
 * usuário que abre o link) — decisão desta task (não coberta pelo AC, que só
 * pede o botão existir): o backend (GET .../qr) devolve horário de PAREDE
 * da arena (America/Sao_Paulo por padrão, ver comentário de pacote em
 * rallye-api/api/internal/dayuse/discover.go), sem embutir o fuso da arena
 * no payload. Tratar esse horário como "local" reproduz corretamente o caso
 * comum (usuário no mesmo fuso da arena reservada) — o caso de fuso
 * diferente entre usuário e arena fica com um desvio conhecido e aceitável
 * pra este MVP (mesma classe de simplificação já usada por "hoje" default
 * em fuso único de mercado, ver marketDefaultLocation no backend).
 */
export function toCalendarDateTime(date: string, time: string): string {
  const datePart = date.replaceAll('-', '')
  const timePart = time.replaceAll(':', '').padEnd(6, '0')
  return `${datePart}T${timePart}`
}

/** Link de template do Google Calendar para "ADICIONAR AO CALENDÁRIO" (DU4).
 * Ver toCalendarDateTime para a limitação de fuso conhecida/aceita. */
export function calendarLink(qr: DayUseQr): string {
  const start = toCalendarDateTime(qr.date, qr.startTime)
  const end = toCalendarDateTime(qr.date, qr.endTime)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Day Use — ${qr.unitName}`,
    dates: `${start}/${end}`,
    details: `Day Use de ${sportLabel(qr.sport)} em ${qr.unitName}.`,
    location: qr.address,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Link de busca do Google Maps pra "COMO CHEGAR" (DU4) — não existe lat/lng
 * no schema (mesmo gap já documentado em DU1/DU2), então a busca é por
 * nome+endereço em texto livre, não coordenadas. */
export function directionsLink(qr: DayUseQr): string {
  const query = qr.address ? `${qr.unitName}, ${qr.address}` : qr.unitName
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query }).toString()}`
}
