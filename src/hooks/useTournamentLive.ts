import { useEffect, useRef } from 'react'

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

/**
 * Relay de tempo real via SSE (BEAC-2011) pra chaves/partidas — GET
 * /tournaments/{id}/live, `EventSource` nativo do browser, sem lib nova.
 * Existe pra não ferir BEAC-1815 (frontend nunca fala com o Supabase): o
 * próprio rallye-api repassa as mudanças de `tournament_matches`/
 * `tournament_match_sets` via Postgres LISTEN/NOTIFY.
 *
 * O evento `match_changed` só carrega `{tournament_id, match_id}` — nunca o
 * estado novo. `onMatchChanged` é responsabilidade de quem usa o hook
 * (refazer o GET da partida/categoria, ver BracketPage/MatchDetailPage).
 *
 * Sem heartbeat/replay no servidor (documentado em BEAC-2011): ao perder a
 * conexão, o EventSource nativo reconecta sozinho (comportamento built-in
 * do browser) e quem usa o hook deve rebuscar o estado via REST na
 * reconexão — este hook não faz isso sozinho, só entrega o evento.
 *
 * Limitação conhecida, não resolvida aqui: no mobile (Capacitor nativo) a
 * sessão viaja via `Authorization: Bearer` (ver httpClient.ts), mas
 * `EventSource` do browser não permite headers customizados — esta
 * conexão só funciona autenticada no fluxo web (cookie `rallye_session`
 * via `withCredentials`). Mobile fica sem live update por enquanto (gap
 * pré-existente do mesmo tipo já aceito em outras partes do app).
 */
export function useTournamentLive(
  tournamentId: string | undefined,
  onMatchChanged: (matchId: string) => void,
): void {
  const onMatchChangedRef = useRef(onMatchChanged)
  useEffect(() => {
    onMatchChangedRef.current = onMatchChanged
  }, [onMatchChanged])

  useEffect(() => {
    if (!tournamentId) return

    const source = new EventSource(
      `${apiBaseUrl()}/tournaments/${encodeURIComponent(tournamentId)}/live`,
      { withCredentials: true },
    )

    function handleMatchChanged(event: MessageEvent) {
      const data = JSON.parse(event.data) as { tournament_id: string; match_id: string }
      onMatchChangedRef.current(data.match_id)
    }

    source.addEventListener('match_changed', handleMatchChanged)

    return () => {
      source.removeEventListener('match_changed', handleMatchChanged)
      source.close()
    }
  }, [tournamentId])
}
