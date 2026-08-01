/**
 * Liga os dois "sensores de ambiente" do TanStack Query aos eventos REAIS do
 * Capacitor quando o app roda como binário nativo (ios/, android/).
 *
 * Por que é necessário:
 *   - `focusManager`: o `refetchOnWindowFocus` do react-query escuta
 *     `visibilitychange`/`focus` do `window`. Numa WebView, voltar do
 *     background NÃO dispara esses eventos de forma confiável — o app
 *     reapareceria mostrando dado velho sem nunca revalidar. O sinal correto
 *     no nativo é `appStateChange` do `@capacitor/app`.
 *   - `onlineManager`: `navigator.onLine` é impreciso em WebView (costuma
 *     reportar `true` mesmo sem conectividade real). O `@capacitor/network`
 *     lê o estado de rede do SO.
 *
 * E no BUILD WEB (o app também roda como Worker no Cloudflare)? Esta função
 * simplesmente NÃO faz nada: `Capacitor.isNativePlatform()` é `false` no
 * navegador, e aí os listeners embutidos do react-query — que são os
 * corretos num browser de verdade — permanecem intactos. Nenhum listener de
 * plugin nativo é registrado onde não existe implementação nativa, e nenhum
 * dos dois plugins é sequer importado no bundle web (os `import()`
 * dinâmicos abaixo só são avaliados no ramo nativo).
 */
import { Capacitor } from '@capacitor/core'
import { focusManager, onlineManager } from '@tanstack/react-query'

/** Desfaz a ligação (usado só por testes; o app chama uma vez e nunca solta). */
export type TeardownPlatformBridge = () => void

const NOOP: TeardownPlatformBridge = () => {}

/**
 * Idempotente: chamar duas vezes não duplica listeners, porque
 * `focusManager.setEventListener`/`onlineManager.setEventListener`
 * SUBSTITUEM o listener anterior (e rodam o cleanup do antigo) em vez de
 * acumular.
 */
export function setupQueryPlatformBridge(): TeardownPlatformBridge {
  if (!Capacitor.isNativePlatform()) return NOOP

  focusManager.setEventListener((handleFocus) => {
    const listener = import('@capacitor/app').then(({ App }) =>
      App.addListener('appStateChange', ({ isActive }) => {
        handleFocus(isActive)
      }),
    )
    return () => {
      void listener.then((handle) => handle.remove())
    }
  })

  onlineManager.setEventListener((setOnline) => {
    const listener = import('@capacitor/network').then(({ Network }) => {
      // Estado inicial: `addListener` só avisa em MUDANÇAS, então sem esta
      // leitura o onlineManager ficaria com o palpite do navegador até a
      // primeira troca de rede.
      void Network.getStatus().then((status) => setOnline(status.connected))
      return Network.addListener('networkStatusChange', (status) => {
        setOnline(status.connected)
      })
    })
    return () => {
      void listener.then((handle) => handle.remove())
    }
  })

  return () => {
    // Troca os listeners nativos por listeners inertes — `setEventListener`
    // roda o cleanup do anterior, então os handles do Capacitor são
    // removidos aqui. Não restaura os listeners embutidos do react-query
    // (a API não expõe isso), o que é irrelevante para o único uso previsto:
    // teardown de teste.
    focusManager.setEventListener(() => NOOP)
    onlineManager.setEventListener(() => NOOP)
  }
}
