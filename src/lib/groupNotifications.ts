// Agrupamento visual "Hoje/Ontem/Esta semana/Mais antigas" da N1 (BEAC-2021)
// — o backend só devolve a lista plana ordenada created_at DESC (ver
// comentário de pacote de rallye-api/.../notifications/read_handler.go), este
// bucketing é puramente client-side. Complementa ./formatRelativeTimestamp.ts
// (que formata "hoje, 09:14"/"ontem, 16:40" por item) sem duplicar a lógica
// de dia-corrente: `startOfDay` aqui segue a mesma ideia.
export type NotificationGroupLabel = 'Hoje' | 'Ontem' | 'Esta semana' | 'Mais antigas'

const GROUP_ORDER: NotificationGroupLabel[] = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas']

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** `now` é injetável (default `new Date()`) pelo mesmo motivo de
 * formatRelativeTimestamp: testável sem mockar relógio global. */
export function notificationGroupLabel(createdAtIso: string, now: Date = new Date()): NotificationGroupLabel {
  const today = startOfDay(now)
  const day = startOfDay(new Date(createdAtIso))
  const diffDays = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays <= 6) return 'Esta semana'
  return 'Mais antigas'
}

/** Bucketa `items` (created_at DESC, mesma ordem do backend) preservando a
 * ordem relativa dentro de cada grupo. Grupos sem item nenhum são omitidos
 * do resultado, na ordem Hoje > Ontem > Esta semana > Mais antigas. */
export function groupNotificationsByRecency<T extends { createdAt: string }>(
  items: T[],
  now: Date = new Date(),
): Array<{ label: NotificationGroupLabel; items: T[] }> {
  const buckets = new Map<NotificationGroupLabel, T[]>(GROUP_ORDER.map((label) => [label, []]))

  for (const item of items) {
    buckets.get(notificationGroupLabel(item.createdAt, now))?.push(item)
  }

  return GROUP_ORDER.map((label) => ({ label, items: buckets.get(label) ?? [] })).filter(
    (group) => group.items.length > 0,
  )
}
