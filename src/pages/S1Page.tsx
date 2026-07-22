import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { BottomSheet } from '../components/BottomSheet/BottomSheet'
import { EnterArenaSheet } from '../components/EnterArenaSheet/EnterArenaSheet'
import { usePermissionsContext } from '../hooks/usePermissionsContext'
import { accessMembership, listMyMemberships, type MembershipListItem } from '../lib/api'
import { dashboardPathForRole } from '../lib/dashboardTarget'
import { sportCssVar, sportLabel } from '../lib/sports'
import './S1Page.css'

const EMPTY_STATE_MESSAGE =
  'Você ainda não faz parte de nenhuma arena. Peça ao administrador para te adicionar ou use um código de convite.'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; memberships: MembershipListItem[] }

/** "AD" a partir de "Arena Areia Dourada" — placeholder de foto ausente
 * (nenhuma membership traz foto hoje, ver AC "foto/inicial ... ou
 * placeholder"). Uma palavra usa as 2 primeiras letras; várias, a inicial da
 * primeira + da última. */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Admin=coral, Professor=aqua, Aluno=muted (AC de BEAC-1835). O design
 * system deste app ainda não tem tokens `coral`/`aqua` dedicados — ver
 * S1Page.css, que reaproveita `--sport-beach-tennis` (coral) e `--teal`
 * (aqua) já existentes em vez de inventar cores novas não revisadas.
 * `role === null` (membership sem role atribuído — RBAC é do Épico 3) não
 * ganha badge nenhum, em vez de um rótulo inventado.
 */
function roleBadgeClass(role: string): string {
  switch (role) {
    case 'Admin':
      return 's1-badge-admin'
    case 'Professor':
      return 's1-badge-professor'
    case 'Aluno':
      return 's1-badge-aluno'
    default:
      return 's1-badge-neutral'
  }
}

function sportSlugs(sportsOffered: unknown): string[] {
  if (!Array.isArray(sportsOffered)) return []
  return sportsOffered.filter((slug): slug is string => typeof slug === 'string')
}

/**
 * S1 — Seletor de arena (BEAC-1681/1835). Markup segue scr-s1 do protótipo
 * real (Artifact "Rallye — Onboarding · Saque Noturno"): `data-arena` por
 * card, `s1OpenDialog`/`s1Code`/`s1DialogConfirm` no fluxo de convite
 * (reaproveitando `EnterArenaSheet`/`BottomSheet` de BEAC-1808 — não
 * recriado aqui).
 */
export default function S1Page() {
  const navigate = useNavigate()
  const { refetch: refetchPermissions } = usePermissionsContext()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [enteringUnitId, setEnteringUnitId] = useState<string | null>(null)

  // Tocar num card (ou o pulo automático de "só 1 membership") é a troca de
  // unit ativa (AC de BEAC-1841): marca last_accessed_at (best-effort — uma
  // falha nessa chamada de bookkeeping não deve travar o usuário do lado de
  // fora da arena), re-busca GET /me/permissions da NOVA unit e só então
  // navega — nessa ordem, pra garantir que o dashboard da nova unit nunca
  // renderiza com o cache de permissions da unit anterior (AC: "antes de
  // qualquer tela da nova unit renderizar").
  const enterMembership = useCallback(
    async (membership: MembershipListItem) => {
      setEnteringUnitId(membership.unitId)
      try {
        await accessMembership(membership.unitId)
      } catch {
        // ver comentário acima — best-effort.
      }
      await refetchPermissions()
      navigate(dashboardPathForRole(membership.role, membership.unitId), { replace: true })
    },
    [navigate, refetchPermissions],
  )

  // Carga "inicial" (mount + botão Retry): se a resposta tiver exatamente 1
  // membership, pula a tela (AC) em vez de renderizar a grade. Encadeada via
  // `.then`/`.catch` (não `async`/`await` no topo) — mesmo padrão de
  // LoginPage.tsx, exigido pelo lint react-hooks/set-state-in-effect: um
  // `setState` só pode ser alcançado a partir do corpo do efeito dentro de
  // um callback assíncrono (`.then`), nunca síncrono na chamada direta.
  const loadInitial = useCallback(
    (onCancelled: () => boolean) => {
      listMyMemberships()
        .then((memberships) => {
          if (onCancelled()) return
          if (memberships.length === 1) {
            void enterMembership(memberships[0])
            return
          }
          setState({ status: 'ready', memberships })
        })
        .catch(() => {
          if (!onCancelled()) setState({ status: 'error' })
        })
    },
    [enterMembership],
  )

  useEffect(() => {
    let cancelled = false
    loadInitial(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadInitial])

  function handleRetry() {
    setState({ status: 'loading' })
    loadInitial(() => false)
  }

  // Refresh silencioso pós-resgate de convite (documentado no próprio
  // EnterArenaSheet: "quando a S1 real existir, o callback de sucesso deve
  // disparar um refresh da lista real"). Deliberadamente NÃO reaplica o
  // pulo automático de "só 1 membership" — o usuário acabou de agir nesta
  // tela e deve ver a confirmação, não ser ejetado. Também não regride para
  // o estado de erro numa falha: o convite JÁ foi resgatado com sucesso;
  // perder essa confirmação por causa de uma falha no refresh seria pior.
  async function refetchAfterRedeem() {
    try {
      const memberships = await listMyMemberships()
      setState({ status: 'ready', memberships })
    } catch {
      // best-effort — ver comentário acima.
    }
  }

  function handleInviteRedeemed() {
    setSheetOpen(false)
    setConfirmation('Você entrou na arena!')
    void refetchAfterRedeem()
  }

  function handleOpenDialog() {
    setConfirmation(null)
    setSheetOpen(true)
  }

  return (
    <main>
      <AuthLayout
        title="Onde você vai jogar hoje?"
        subtitle="Você faz parte destas arenas — toque para entrar. Ordenadas pelo último acesso."
        mark="sm"
        formMaxWidth={820}
      >
        {state.status === 'loading' && (
          <div className="arena-grid s1-skeleton-grid" role="status" aria-label="Carregando arenas">
            <div className="s1-skeleton-card" />
            <div className="s1-skeleton-card" />
            <div className="s1-skeleton-card" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="s1-error">
            <p>Não foi possível carregar suas arenas agora.</p>
            <button type="button" className="btn btn-secondary btn-md" onClick={handleRetry}>
              Tentar novamente
            </button>
          </div>
        )}

        {state.status === 'ready' && state.memberships.length === 0 && (
          <p className="s1-empty">{EMPTY_STATE_MESSAGE}</p>
        )}

        {state.status === 'ready' && state.memberships.length > 0 && (
          <div className="arena-grid">
            {state.memberships.map((membership) => (
              <button
                key={membership.unitId}
                type="button"
                className="arena-card"
                data-arena={membership.unitId}
                disabled={enteringUnitId !== null}
                onClick={() => enterMembership(membership)}
              >
                <div className="arena-cover">
                  <span className="initials">{initialsFor(membership.unit.name)}</span>
                  {membership.liveActivity && (
                    <span className="live badge badge-success">{membership.liveActivity}</span>
                  )}
                </div>
                <div className="arena-body">
                  <div className="row1">
                    <span className="name">{membership.unit.name}</span>
                    {membership.role && (
                      <span className={`badge ${roleBadgeClass(membership.role)}`}>
                        {membership.role}
                      </span>
                    )}
                  </div>
                  {membership.unit.address && <div className="city">{membership.unit.address}</div>}
                  {sportSlugs(membership.unit.sportsOffered).length > 0 && (
                    <div className="arena-sports">
                      {sportSlugs(membership.unit.sportsOffered).map((slug) => (
                        <span className="sporttag" key={slug}>
                          <span
                            className="dot"
                            style={{ background: `var(${sportCssVar(slug)})` }}
                          />
                          {sportLabel(slug)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {confirmation && (
          <p role="status" className="s1-confirmation">
            {confirmation}
          </p>
        )}

        {state.status !== 'loading' && (
          <div className="s1-invite-row">
            <button
              type="button"
              className="btn btn-secondary btn-md"
              id="s1OpenDialog"
              onClick={handleOpenDialog}
            >
              Entrar em nova arena com código
            </button>
          </div>
        )}

        <div className="foot-note">
          Dica: segure o logo do app para trocar de arena a qualquer momento, sem sair da conta.
        </div>
      </AuthLayout>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        label="Entrar em nova arena"
      >
        <EnterArenaSheet
          onSuccess={handleInviteRedeemed}
          codeInputId="s1Code"
          submitButtonId="s1DialogConfirm"
        />
      </BottomSheet>
    </main>
  )
}
