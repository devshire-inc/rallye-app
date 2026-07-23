// Helpers puros de exibição do período de uma assinatura (PL4, BEAC-1937) —
// separados do componente pra serem testáveis sem renderizar nada, mesmo
// padrão de ./invoiceStatus.ts/./dashboardTarget.ts.
//
// # Por que a barra de progresso não usa `new Date()`
//
// GET /students/{id}/subscription (BEAC-1972) já devolve `remainingDays`
// calculado pelo backend a partir do "hoje" do SERVIDOR (ver
// subscriptions.remainingDays em rallye-api). Derivar a barra de progresso a
// partir de `remainingDays` (em vez de comparar `endDate` com o relógio do
// navegador) evita qualquer divergência de fuso/hora entre cliente e
// servidor — a mesma fonte de verdade que já decide "em quantos dias renova"
// decide também "quanto do período já passou".
export function totalPeriodDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/** % do período já decorrido, 0-100. `remainingDays` conta hoje como ainda
 * "restante" (mesma convenção do backend, ver subscriptions.remainingDays),
 * então o dia corrente nunca soma como decorrido — no último dia do
 * período a barra fica perto de 100%, não exatamente 100%, até
 * `remainingDays` chegar a 0. */
export function periodProgressPercent(
  startDate: string,
  endDate: string,
  remainingDays: number,
): number {
  const total = totalPeriodDays(startDate, endDate)
  if (total <= 0) return 100
  const elapsed = total - remainingDays
  const pct = Math.round((elapsed / total) * 100)
  return Math.min(100, Math.max(0, pct))
}

/** Doc real (PL4, `scr-pl4`), estado "Expirando": aviso quando faltam menos
 * de 7 dias pra renovação. 0 (período já encerrado) não conta como
 * "expirando em breve" — é um estado diferente (fora do escopo desta task:
 * GetHandler só devolve assinaturas status='active', ver comentário de
 * pacote em subscriptions/handler.go). */
export function isExpiringSoon(remainingDays: number): boolean {
  return remainingDays > 0 && remainingDays < 7
}

/** ISO ('AAAA-MM-DD') -> "DD/MM/AAAA", mesmo padrão de formatDate() já
 * duplicado em VincularPlanoSheet.tsx/F5MyInvoicesPage.tsx. */
export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
