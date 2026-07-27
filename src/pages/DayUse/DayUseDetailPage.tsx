import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getDayUseDetail, type DayUseDetail } from '../../lib/api/dayUseFlow'
import { formatBRL } from '../../lib/money'
import { sportCssVar, sportLabel } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import './DayUseDetailPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; detail: DayUseDetail }

/** Mesmo caminho de DU3 usado por DayUseDiscoveryPage.tsx. Diferente de lá,
 * esta tela não repassa `date` via router state (DU2 sempre mostra "hoje",
 * sem seletor de data) — DU3 cai no default "hoje" quando chega por aqui
 * (ver comentário de pacote em DayUseConfirmPage.tsx). */
function du3Path(unitId: string): string {
  return `/day-use/${unitId}/confirm`
}

/**
 * DU2 — Detalhe Arena Day Use (BEAC-1961, story BEAC-1928). Markup/copy
 * lidos diretamente da doc real (Allye, UX e Telas > Financeiro > DU2 —
 * Detalhe Arena Day Use): esportes, endereço, quadras, card de Day Use
 * (preço, horário, vagas com progress bar), CTA "RESERVAR DAY USE — R$ X".
 *
 * Consome GET /units/{id}/day-use-detail?date= (BEAC-1957) — mesma postura
 * cross-tenant/sem permission dedicada de DU1 (ver comentário de pacote em
 * DayUseDiscoveryPage.tsx).
 *
 * ## Divergências deliberadas da doc (documentadas, não inventadas)
 *
 * - **Foto carousel / rating**: mesma ausência de dado que DU1 — sem coluna
 *   de foto/rating no backend (ver rallye-api/api/internal/dayuse/
 *   detail.go). Mostra um placeholder de ícone por esporte no lugar do
 *   carousel; omite o bloco de rating por completo (nunca um "0.0" ou
 *   "N/A" fixo).
 * - **Horário geral da arena** ("⏰ 06:00-22:00" fora do card de Day Use):
 *   omitido — `operating_hours` é JSON de formato livre não tipado (ver
 *   detail.go); o horário QUE IMPORTA pra Day Use (DayUseInfo.startTime/
 *   EndTime) já aparece dentro do próprio card de Day Use.
 * - **"Sobre a arena" (descrição)**: omitido — não existe coluna de
 *   descrição em public.units.
 * - **"Vagas atualizam em tempo real" (Regra 1 da doc)**: implementado como
 *   uma leitura fresca a cada carregamento da tela (sem polling/websocket —
 *   nenhuma infra desse tipo existe nesta base, ver busca por `setInterval`
 *   em outras páginas: só timers visuais, nunca refetch periódico). O CTA
 *   reflete o `lotado`/`slotsLeft` da resposta MAIS RECENTE já carregada; a
 *   corrida real "lotou entre o carregamento desta tela e o clique em
 *   RESERVAR" é responsabilidade do estado "Ops! Última vaga foi
 *   preenchida" de DU3 (BEAC-1962), que é onde o AC da story já esperava
 *   essa checagem definitiva acontecer (no momento da confirmação, não do
 *   detalhe).
 */
export default function DayUseDetailPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId) return
      getDayUseDetail(unitId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState(result.status === 404 ? { status: 'not-found' } : { status: 'error' })
            return
          }
          setState({ status: 'ready', detail: result.detail })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <span className="back" style={{ opacity: 0.55 }}>
          ‹ {state.status === 'ready' ? state.detail.name : 'Day Use'}
        </span>
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <p role="status">Carregando arena…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar os detalhes desta arena.</p>
        ) : null}
        {state.status === 'not-found' ? <p role="alert">Arena não encontrada.</p> : null}

        {state.status === 'ready' ? (
          <ArenaDetail
            detail={state.detail}
            onReserve={() => unitId && navigate(du3Path(unitId))}
          />
        ) : null}
      </div>
    </AppShell>
  )
}

function ArenaDetail({ detail, onReserve }: { detail: DayUseDetail; onReserve: () => void }) {
  const allSports = detail.dayUse?.sports ?? []

  return (
    <>
      <div className="du2-photo" aria-hidden="true">
        {allSports[0] ? (
          <span
            className="sdot du2-photo-dot"
            style={{ background: `var(${sportCssVar(allSports[0])})` }}
          />
        ) : null}
      </div>

      {allSports.length > 0 ? (
        <div className="du2-sports">
          {allSports.map((s) => (
            <span key={s} className="badge b-neutral">
              {sportLabel(s)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="du2-address">📍 {detail.address}</div>
      {detail.courtsSummary ? <div className="hint">🏐 {detail.courtsSummary}</div> : null}

      {detail.dayUse ? (
        <div className="card du2-day-use-card">
          <div className="du2-price">{formatBRL(detail.dayUse.price)} /dia</div>
          <div className="hint">Inclui: {allSports.map((s) => sportLabel(s)).join(', ')}</div>
          <div className="hint">
            Horário: {detail.dayUse.startTime} - {detail.dayUse.endTime}
          </div>
          <div className="du2-slots">
            <div className="hint">
              Vagas: {detail.dayUse.slotsTotal - detail.dayUse.slotsLeft} de{' '}
              {detail.dayUse.slotsTotal}
            </div>
            <div
              className="du2-progress"
              role="progressbar"
              aria-valuenow={detail.dayUse.slotsTotal - detail.dayUse.slotsLeft}
              aria-valuemin={0}
              aria-valuemax={detail.dayUse.slotsTotal}
            >
              <div
                className="du2-progress-fill"
                style={{
                  width: `${detail.dayUse.slotsTotal > 0 ? ((detail.dayUse.slotsTotal - detail.dayUse.slotsLeft) / detail.dayUse.slotsTotal) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="hint">Day Use não disponível para esta data.</p>
      )}

      <button
        type="button"
        className="btn btn-primary du2-cta"
        disabled={!detail.dayUse || detail.dayUse.lotado}
        onClick={onReserve}
      >
        {detail.dayUse && !detail.dayUse.lotado
          ? `RESERVAR DAY USE — ${formatBRL(detail.dayUse.price)}`
          : 'LOTADO'}
      </button>
    </>
  )
}
