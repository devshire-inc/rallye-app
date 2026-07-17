// Formata um timestamp ISO no mesmo padrão do protótipo real (Artifact
// "Rallye — Perfil & Config", seção scr-c3/data-pp=auditoria, lido
// diretamente antes de implementar BEAC-1848): "hoje, 09:14" / "ontem,
// 16:40" para entradas recentes, "3 de julho, 11:02" (dia sem zero à
// esquerda + mês por extenso em português, sem ano) para entradas mais
// antigas. `now` é injetável (default `new Date()`) só para tornar a função
// testável sem mockar relógio global.
const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function formatRelativeTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`

  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const day = startOfDay(date)

  if (day.getTime() === today.getTime()) return `hoje, ${time}`
  if (day.getTime() === yesterday.getTime()) return `ontem, ${time}`

  return `${date.getDate()} de ${MONTHS_PT[date.getMonth()]}, ${time}`
}
