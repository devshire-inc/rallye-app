// Estado local mínimo da sessão temporária de visitante (A5, BEAC-1817).
//
// A sessão de verdade é o cookie `rallye_session` (stateless, emitido pelo
// BFF) — este storage NÃO é a sessão em si, é só o suficiente para a UI
// saber "estou numa sessão temporária" e renderizar o banner de conversão
// ("Acesso temporário · Criar conta completa?") persistentemente enquanto
// ela durar, e para pré-preencher o e-mail ao navegar para o cadastro (A2).
const STORAGE_KEY = 'rallye_visitor_session'

export type VisitorSessionState = {
  email: string
  tournamentId: string
  scope: string
  expiresAt: string
}

export function setVisitorSession(data: VisitorSessionState): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getVisitorSession(): VisitorSessionState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<VisitorSessionState>
    if (
      typeof parsed.email === 'string' &&
      typeof parsed.tournamentId === 'string' &&
      typeof parsed.scope === 'string' &&
      typeof parsed.expiresAt === 'string'
    ) {
      // Banner só deve aparecer enquanto a sessão temporária ainda vale —
      // se já passou de expiresAt, trata como se não houvesse sessão.
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        clearVisitorSession()
        return null
      }
      return parsed as VisitorSessionState
    }
    return null
  } catch {
    return null
  }
}

export function clearVisitorSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
