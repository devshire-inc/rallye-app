import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button/Button'
import { Input } from '../../components/ui/Input/Input'
import { Switch } from '../../components/ui/Switch/Switch'
import { usePermission } from '../../hooks/usePermission'
import {
  DAY_PILLS,
  listDayUseConfigs,
  patchDayUseConfig,
  type DayUseConfig,
} from '../../lib/api/dayUse'
import { sportCssVar, sportLabel } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './DayUseConfigPage.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; configs: DayUseConfig[] }

// Cópia exata lida diretamente do protótipo real (Artifact "Rallye —
// Financeiro · Saque Noturno", claude.ai/code/artifact/89d79e7b-44f5-4a88-937b-4f36d03f7a45,
// seção `id="scr-du5"`) — não parafraseada de memória.
const SEPARATE_SCREEN_TOAST_TEXT =
  'Tela própria, fora de "Configurações da arena" — cada quadra tem seu esporte, horário, preço e vagas de Day Use configurados individualmente.'

const BOOKING_VISIBILITY_HINT_TEXT =
  'Reserva de Day Use aparece na agenda normal (AG1/AG2) com tag visual, além desta config e da listagem administrativa (DU6).'

/**
 * DU5 — Config Day Use (BEAC-1955, story BEAC-1712 — "Toggle de Day Use por
 * quadra em DU5"). Markup/copy lidos diretamente do protótipo real (Artifact
 * "Rallye — Financeiro · Saque Noturno", seção `id="scr-du5"`, HTML salvo em
 * .claude/.../tool-results/artifact-89d79e7b-1783743889-d509.html linhas
 * ~1085-1149): `.toast.toast-neutral` fixo, um `.card` por quadra
 * (`.sdot` + nome + esporte + `.switch`), `.form-grid` (Preço/Vagas por dia/
 * Horário liberado/Dias disponíveis em `.tabs2`) só QUANDO ligado, botão
 * "Ver reservas" -> DU6, `.hint-note` fixo no rodapé.
 *
 * ## Autorização (AC da task: "financeiro:write" cobre GET e PATCH)
 *
 * Toda a tela é gate por `usePermission('financeiro', 'write')` — "esconder
 * sempre, nunca desabilitar" (usePermission.ts): sem a permission, nenhum
 * card/toast/hint é renderizado (mesmo padrão de ArenaSettingsPage quando
 * falta `config:read`), e nenhum fetch é disparado.
 *
 * ## Sem botão "Salvar" — decisão desta task
 *
 * O protótipo real não tem nenhum botão de salvar em scr-du5 (só o toggle
 * tem uma interação JS inline). Como esta é uma tela funcional (não um mock
 * estático), cada controle salva imediatamente: o toggle e os pills de dia
 * disparam PATCH ao clicar; os campos de texto (preço/vagas/horário) salvam
 * `onBlur` (só se o valor mudou) — evita inventar um botão "Salvar" que não
 * existe no protótipo, mantendo a tela funcional.
 *
 * ## "Ver reservas" -> DU6
 *
 * O botão navega para `/units/{id}/day-use/reservas` — a rota de DU6 (BEAC-
 * 1955 não incluía essa tela) foi registrada por BEAC-1966 (mesma story
 * BEAC-1713), ver App.tsx e DayUseBookingsPage.tsx. Este link em si não
 * mudou desde que foi escrito.
 *
 * ## Horário liberado — 2 inputs, não 1 (decisão desta task)
 *
 * O protótipo mostra um único input de texto com "08:00–18:00". O backend
 * modela start_time/end_time como colunas TIME separadas (migrations/000046)
 * — um parser de texto livre pra um intervalo seria frágil para um formulário
 * real. Implementado como dois `<input type="time">` lado a lado sob o mesmo
 * label "Horário liberado" (mesma disposição/tamanho visual do protótipo,
 * span2), mantendo a funcionalidade correta.
 */
export default function DayUseConfigPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const canManage = usePermission('financeiro', 'write')

  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId || !canManage) return
      listDayUseConfigs(unitId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', configs: result.configs })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, canManage],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  function handleUpdated(updated: DayUseConfig) {
    setState((prev) =>
      prev.status === 'ready'
        ? {
            status: 'ready',
            configs: prev.configs.map((c) => (c.courtId === updated.courtId ? updated : c)),
          }
        : prev,
    )
  }

  return (
    <>
      <div className="pg-head">
        <span className="back" style={{ opacity: 0.55 }}>
          ‹ Gestão
        </span>
        <h1>Config Day Use</h1>
        <div className="spacer" />
        {canManage ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => unitId && navigate(`/units/${unitId}/day-use/reservas`)}
          >
            Ver reservas
          </Button>
        ) : null}
      </div>

      {!canManage ? null : (
        <div className="dash-body">
          <div className="toast toast-neutral" role="status">
            {SEPARATE_SCREEN_TOAST_TEXT}
          </div>

          {state.status === 'loading' ? <PageLoading label="Carregando quadras" variant="list" /> : null}
          {state.status === 'error' ? (
            <p role="alert">Não foi possível carregar a configuração de Day Use desta arena.</p>
          ) : null}

          {state.status === 'ready' ? (
            <>
              {state.configs.length === 0 ? (
                <p className="hint">Esta arena ainda não tem quadras cadastradas.</p>
              ) : (
                state.configs.map((config) => (
                  // key inclui os campos persistidos (não só courtId):
                  // remonta o card sempre que `config` muda por fora (ex.:
                  // resposta de um PATCH bem-sucedido), recalculando os
                  // useState iniciais a partir do valor fresco — evita
                  // sincronizar estado local via useEffect (padrão
                  // desencorajado, ver https://react.dev/learn/you-might-not-need-an-effect
                  // e a regra react-hooks/set-state-in-effect).
                  <DayUseCourtCard
                    key={`${config.courtId}:${config.enabled}:${config.price}:${config.slotsPerDay}:${config.startTime}:${config.endTime}:${config.availableDays.join(',')}`}
                    config={config}
                    onUpdated={handleUpdated}
                  />
                ))
              )}
            </>
          ) : null}
        </div>
      )}

      {!canManage ? null : <p className="hint-note">{BOOKING_VISIBILITY_HINT_TEXT}</p>}
    </>
  )
}

/** Formata um valor em reais para o texto do campo Preço (ex.: 45.5 ->
 * "R$ 45,50") — mesmo estilo do protótipo real ("R$ 45,00"). */
function formatPriceInput(value: number | null): string {
  if (value === null) return ''
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Extrai um número de um texto de preço em qualquer formato razoável
 * (ex.: "R$ 45,00", "45,00", "45.00", "45") — só dígitos/vírgula/ponto
 * contam; vírgula é tratada como separador decimal (padrão pt-BR). Retorna
 * `null` para texto vazio/sem nenhum dígito (campo limpo). */
function parsePriceInput(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '')
  const withDot = normalized.replace(',', '.')
  const parsed = Number.parseFloat(withDot)
  return Number.isFinite(parsed) ? parsed : null
}

interface DayUseCourtCardProps {
  config: DayUseConfig
  onUpdated: (updated: DayUseConfig) => void
}

function DayUseCourtCard({ config, onUpdated }: DayUseCourtCardProps) {
  const [priceText, setPriceText] = useState(() => formatPriceInput(config.price))
  const [slotsText, setSlotsText] = useState(() => (config.slotsPerDay ?? '').toString())
  const [startTime, setStartTime] = useState(config.startTime ?? '')
  const [endTime, setEndTime] = useState(config.endTime ?? '')
  const [saveError, setSaveError] = useState(false)

  async function save(payload: Parameters<typeof patchDayUseConfig>[1]) {
    setSaveError(false)
    const result = await patchDayUseConfig(config.courtId, payload)
    if (!result.ok) {
      setSaveError(true)
      return
    }
    onUpdated(result.config)
  }

  function handleToggle(nextEnabled: boolean) {
    void save({ enabled: nextEnabled })
  }

  function handlePriceBlur() {
    const parsed = parsePriceInput(priceText)
    if (parsed === null || parsed === config.price) return
    void save({ price: parsed })
  }

  function handleSlotsBlur() {
    const parsed = Number.parseInt(slotsText, 10)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === config.slotsPerDay) return
    void save({ slotsPerDay: parsed })
  }

  function handleTimeBlur() {
    if (!startTime || !endTime) return
    if (startTime === config.startTime && endTime === config.endTime) return
    void save({ startTime, endTime })
  }

  function handleToggleDay(day: number) {
    const nextDays = config.availableDays.includes(day)
      ? config.availableDays.filter((d) => d !== day)
      : [...config.availableDays, day]
    void save({ availableDays: nextDays })
  }

  return (
    <div className="card day-use-card" data-testid={`day-use-card-${config.courtId}`}>
      <div className="due-head">
        <span className="sdot" style={{ background: `var(${sportCssVar(config.sport)})` }} />
        <div className="due-title">
          <b>
            {config.courtName} · {sportLabel(config.sport)}
          </b>
          <div className="due-subtitle">{sportLabel(config.sport)}</div>
        </div>
        <Switch
          checked={config.enabled}
          ariaLabel={`Ativar Day Use em ${config.courtName}`}
          onChange={handleToggle}
        />
      </div>

      {config.enabled ? (
        <div className="form-grid">
          <Input
            id={`due-price-${config.courtId}`}
            label="Preço"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            onBlur={handlePriceBlur}
          />
          <Input
            id={`due-slots-${config.courtId}`}
            label="Vagas/dia"
            type="number"
            min={1}
            value={slotsText}
            onChange={(e) => setSlotsText(e.target.value)}
            onBlur={handleSlotsBlur}
          />
          <div className="field span2">
            <label htmlFor={`due-start-${config.courtId}`}>Horário liberado</label>
            <div className="due-time-range">
              <input
                id={`due-start-${config.courtId}`}
                className="due-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onBlur={handleTimeBlur}
              />
              <span>–</span>
              <input
                aria-label="Horário de fim"
                className="due-time-input"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                onBlur={handleTimeBlur}
              />
            </div>
          </div>
          <div className="field span2">
            <label>Dias disponíveis</label>
            <div
              className="tabs2"
              role="group"
              aria-label={`Dias disponíveis em ${config.courtName}`}
            >
              {DAY_PILLS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={config.availableDays.includes(day.value) ? 'active' : ''}
                  aria-pressed={config.availableDays.includes(day.value)}
                  onClick={() => handleToggleDay(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {saveError ? (
        <p role="alert" className="due-error">
          Não foi possível salvar. Tente novamente.
        </p>
      ) : null}
    </div>
  )
}
