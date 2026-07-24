// Service Worker do FCM (Web Push, BEAC-1723/BEAC-2019). Registrado por
// src/lib/push.ts via navigator.serviceWorker.register('/firebase-messaging-sw.js')
// — precisa viver na RAIZ do site (não em src/) pra ter escopo sobre o
// domínio inteiro, exigência do Service Worker API.
//
// Roda fora do bundle do Vite (contexto de worker isolado, sem import ESM
// de node_modules) — por isso usa os scripts "compat" do Firebase via
// importScripts em vez de `import` do pacote npm `firebase` (usado pelo
// resto do app em src/lib/push.ts).
//
// Config pública do Firebase (apiKey etc. NÃO são segredo — são as mesmas
// chaves client-side embutidas em qualquer app Firebase, protegidas por
// regras de segurança do lado do servidor, não por sigilo) é injetada via
// query string na URL de registro (ver push.ts) porque um Service Worker
// não tem acesso a import.meta.env do Vite. Sem os parâmetros (dev/CI sem
// Firebase configurado), o worker sobe mas onBackgroundMessage nunca
// recebe nada — inofensivo.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

const params = new URL(self.location.href).searchParams
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

const messaging = firebase.messaging()

// Mensagem recebida com o app fechado/em background: mostra a notificação
// nativa do SO. data carrega type/reference_type/reference_id (deep link,
// mesmo contrato do lado nativo — ver src/lib/push.ts, PushNotifications
// addListener('pushNotificationActionPerformed')).
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Rallye'
  const options = {
    body: payload.notification?.body ?? '',
    icon: '/favicon.svg',
    data: payload.data ?? {},
  }
  self.registration.showNotification(title, options)
})

// Tap na notificação (background/fechado): foca uma aba existente ou abre
// uma nova na raiz do app — o deep link exato por reference_type/
// reference_id é resolvido no lado do app já aberto (App.tsx escuta o
// mesmo padrão de evento do lado nativo não se aplica aqui, já que web não
// tem o listener pushNotificationActionPerformed do Capacitor; navegação
// fina por tipo de notificação no clique de push web é um gap aceito desta
// task — abrir o app já cumpre o objetivo mínimo de levar o usuário de
// volta pra ele).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
