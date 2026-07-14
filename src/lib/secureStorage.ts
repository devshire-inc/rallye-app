/**
 * Abstrai a persistência do session_token/refresh_token entre web e mobile
 * (BEAC-1795, decisão locked: no mobile o token NUNCA fica em cookie/
 * localStorage — sempre em secure storage nativo).
 *
 * - Web: no-op. A sessão web é inteiramente carregada pelo cookie
 *   `rallye_session` (HttpOnly, setado pelo BFF) — o frontend nunca lê nem
 *   guarda o token manualmente.
 * - Mobile (Capacitor nativo): persiste via Keychain (iOS) / Keystore
 *   (Android), usando o plugin `@aparajita/capacitor-secure-storage`.
 *
 * Escolha do plugin (decisão desta execução, documentar no PR): entre as
 * opções mantidas do ecossistema Capacitor 8 (`@aparajita/capacitor-secure-storage`,
 * `capacitor-secure-storage-plugin`, `@capgo/capacitor-secure-storage`),
 * optamos por `@aparajita/capacitor-secure-storage` por ser TypeScript-first,
 * ativamente mantido para Capacitor 6/7/8, e expor uma API simples
 * (getItem/setItem/removeItem) que já usa Keychain/Keystore por padrão sem
 * configuração extra.
 */
import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

export const SESSION_TOKEN_KEY = 'rallye_session_token'
export const REFRESH_TOKEN_KEY = 'rallye_refresh_token'

/** true quando rodando como app nativo (iOS/Android via Capacitor). */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

async function getItem(key: string): Promise<string | null> {
  if (!isNativePlatform()) return null
  return SecureStorage.getItem(key)
}

async function setItem(key: string, value: string): Promise<void> {
  if (!isNativePlatform()) return
  await SecureStorage.setItem(key, value)
}

async function removeItem(key: string): Promise<void> {
  if (!isNativePlatform()) return
  await SecureStorage.removeItem(key)
}

export function getSessionToken(): Promise<string | null> {
  return getItem(SESSION_TOKEN_KEY)
}

export function setSessionToken(token: string): Promise<void> {
  return setItem(SESSION_TOKEN_KEY, token)
}

export function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): Promise<void> {
  return setItem(REFRESH_TOKEN_KEY, token)
}

/** Remove ambos os tokens do secure storage — chamado no logout. No-op na web. */
export async function clearTokens(): Promise<void> {
  await Promise.all([removeItem(SESSION_TOKEN_KEY), removeItem(REFRESH_TOKEN_KEY)])
}
