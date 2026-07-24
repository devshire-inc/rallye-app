/**
 * Registro de push notification — web (FCM via Service Worker) e nativo
 * (FCM/APNs via @capacitor/push-notifications), story BEAC-1723
 * (BEAC-2019/BEAC-2020). Provedor único FCM (decisão travada do Épico 10):
 * web fala com firebase/messaging + public/firebase-messaging-sw.js,
 * nativo fala com @capacitor/push-notifications (Android via FCM direto,
 * iOS via relay de APNs do FCM) — ambos chamam POST /me/push-tokens
 * (BEAC-2017) com platform correta.
 *
 * Fluxo de permissão é sempre disparado por quem chama setupPushNotifications
 * num momento NÃO intrusivo (ex.: depois da primeira sessão estabelecida,
 * nunca no carregamento cru da página) — ver App.tsx, usePushNotificationsSetup.
 *
 * Auto-renovação de token (AC da story): o token do browser pode rotacionar
 * (Firebase decide isso internamente) — cada chamada de setupWebPush busca o
 * token atual via getToken() de novo e só faz POST se ele mudou desde o
 * último registro bem-sucedido (localStorage). No nativo, o listener
 * `registration` do plugin já dispara de novo quando o provedor rotaciona o
 * token — mesma lógica de registerToken cobre os dois casos.
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { apiFetch } from './httpClient'

/** Disparado quando o usuário toca numa notificação nativa (app em
 * background/fechado) — o payload de dados (type/reference_type/
 * reference_id) vai no detail. App.tsx escuta isso pra fazer o deep link
 * (ver src/lib/notificationRouting.ts para a resolução de rota). */
export const PUSH_NOTIFICATION_TAPPED_EVENT = 'rallye:push-notification-tapped'

const LAST_REGISTERED_TOKEN_KEY = 'rallye:push:last-token'

type Platform = 'web' | 'ios' | 'android'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** POST /me/push-tokens, pulando a chamada se este EXATO token já foi
 * registrado com sucesso da última vez (evita reenviar em todo boot/refresh
 * de sessão) — comparação simples via localStorage, suficiente porque um
 * token mudado (rotação) sempre é um valor diferente do último salvo. */
async function registerToken(platform: Platform, fcmToken: string): Promise<void> {
  if (localStorage.getItem(LAST_REGISTERED_TOKEN_KEY) === fcmToken) return

  const response = await apiFetch('/me/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ platform, fcm_token: fcmToken }),
  })
  if (response.ok) {
    localStorage.setItem(LAST_REGISTERED_TOKEN_KEY, fcmToken)
  }
}

/** BEAC-2019: fluxo de permissão + registro de token FCM no browser (Web/PWA). */
export async function setupWebPush(): Promise<void> {
  if (typeof Notification === 'undefined') return
  if (!(await isSupported())) return

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return

  if (!navigator.serviceWorker) return
  // Um Service Worker não enxerga import.meta.env do Vite — a config
  // pública do Firebase (não é segredo, ver comentário de
  // public/firebase-messaging-sw.js) viaja via query string da própria URL
  // de registro, que o worker lê de self.location.href.
  const swURL = new URL('/firebase-messaging-sw.js', window.location.origin)
  for (const [key, value] of Object.entries(firebaseConfig)) {
    if (value) swURL.searchParams.set(key, value)
  }
  const registration = await navigator.serviceWorker.register(swURL.pathname + swURL.search)

  const app = initializeApp(firebaseConfig)
  const messaging = getMessaging(app)
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (token) {
    await registerToken('web', token)
  }

  // Mensagem recebida com a aba em foreground: FCM não mostra notificação
  // nativa sozinho nesse caso. Exibir um toast in-app é UI fora do escopo
  // desta task — o listener só precisa existir pra não deixar a lib
  // reclamar de handler ausente.
  onMessage(messaging, () => {})
}

/** BEAC-2020: fluxo de permissão + registro de token nativo (iOS/Android via
 * Capacitor) + deep link no tap. */
export async function setupNativePush(): Promise<void> {
  const status = await PushNotifications.checkPermissions()
  let granted = status.receive === 'granted'
  if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
    const requested = await PushNotifications.requestPermissions()
    granted = requested.receive === 'granted'
  }
  if (!granted) return

  await PushNotifications.register()

  PushNotifications.addListener('registration', (token) => {
    const platform: Platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
    void registerToken(platform, token.value)
  })

  PushNotifications.addListener('registrationError', (error) => {
    console.error('push: falha ao registrar no provedor nativo', error)
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data as Record<string, string> | undefined
    if (!data) return
    window.dispatchEvent(new CustomEvent(PUSH_NOTIFICATION_TAPPED_EVENT, { detail: data }))
  })
}

/** Ponto de entrada único — chamado num momento não-intrusivo (ver
 * App.tsx). Nunca lança: qualquer falha de configuração/permissão só é
 * logada, já que push é um reforço opcional (a notificação in-app sempre
 * existe independente disso, ver rallye-api/api/internal/notifications). */
export async function setupPushNotifications(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await setupNativePush()
    } else {
      await setupWebPush()
    }
  } catch (error) {
    console.error('push: falha ao configurar notificações', error)
  }
}
