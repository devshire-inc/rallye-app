// Handoff mínimo entre a A5 etapa 1 (informar e-mail) e etapa 2 (código):
// guarda email + tournament_id em sessionStorage após um POST
// /auth/visitor/request bem-sucedido, para a etapa 2 saber para quem
// verificar o código sem repassar tudo pela URL.
const STORAGE_KEY = 'rallye_pending_visitor_request'

export type PendingVisitorRequest = {
  email: string
  tournamentId: string
}

export function getPendingVisitorRequest(): PendingVisitorRequest | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingVisitorRequest>
    if (typeof parsed.email === 'string' && typeof parsed.tournamentId === 'string') {
      return { email: parsed.email, tournamentId: parsed.tournamentId }
    }
    return null
  } catch {
    return null
  }
}

export function setPendingVisitorRequest(data: PendingVisitorRequest): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearPendingVisitorRequest(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
