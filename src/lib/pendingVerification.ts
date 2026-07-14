// Handoff mínimo entre o cadastro por senha (fora deste worktree) e a tela
// A4: guarda user_id + email em sessionStorage logo após POST /auth/signup,
// para a tela de verificação exibir o e-mail e identificar o usuário sem
// precisar de uma sessão autenticada ainda (a conta segue 'pending').
const STORAGE_KEY = 'rallye_pending_verification'

export type PendingVerification = {
  userId: string
  email: string
}

export function getPendingVerification(): PendingVerification | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingVerification>
    if (typeof parsed.userId === 'string' && typeof parsed.email === 'string') {
      return { userId: parsed.userId, email: parsed.email }
    }
    return null
  } catch {
    return null
  }
}

export function setPendingVerification(data: PendingVerification): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearPendingVerification(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
