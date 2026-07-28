// Extraído de AG4TeacherAgendaPage.tsx (dispatch avulso, sem story/task no
// Allye) para ser reaproveitado por D1Dashboard.tsx (BEAC-2093, story
// BEAC-1736) sem duplicar — ambos precisam agrupar bookings multi-arena
// por unit. `Booking` já carrega `unitId`/`unitName` por linha (campos
// agregados no backend), então esta função não precisa de um mapa
// unit_id -> nome separado.
import type { Booking } from '../api/bookings'

export interface GroupedByArena {
  unitId: string
  unitName: string
  items: Booking[]
}

/** Agrupa bookings por arena (unitId), ordenando os itens de cada grupo por
 * horário e os grupos alfabeticamente pelo nome da arena. */
export function groupByArenaLabel(bookings: Booking[]): GroupedByArena[] {
  const groups = new Map<string, { unitName: string; items: Booking[] }>()
  for (const b of bookings) {
    const g = groups.get(b.unitId) ?? { unitName: b.unitName, items: [] }
    g.items.push(b)
    groups.set(b.unitId, g)
  }
  return Array.from(groups.entries())
    .map(([unitId, g]) => ({
      unitId,
      unitName: g.unitName,
      items: g.items.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime()),
    }))
    .sort((a, b) => a.unitName.localeCompare(b.unitName))
}
