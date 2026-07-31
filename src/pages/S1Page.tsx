import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { BottomSheet } from '../components/BottomSheet/BottomSheet'
import { EnterArenaSheet } from '../components/EnterArenaSheet/EnterArenaSheet'
import { ArenaCard } from '../components/ui/ArenaCard/ArenaCard'
import { Button } from '../components/ui/Button/Button'
import { EmptyState } from '../components/ui/EmptyState/EmptyState'
import { Icon } from '../components/ui/Icon/Icon'
import { Skeleton, SkeletonGroup } from '../components/ui/Skeleton/Skeleton'
import { usePermissionsContext } from '../hooks/usePermissionsContext'
import { accessMembership, listMyMemberships, type MembershipListItem } from '../lib/api'
import { dashboardPathForRole } from '../lib/dashboardTarget'
import './S1Page.css'

const EMPTY_STATE_MESSAGE =
  'Você ainda não faz parte de nenhuma arena. Peça ao administrador para te adicionar ou use um código de convite.'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; memberships: MembershipListItem[] }

function sportSlugs(sportsOffered: unknown): string[] {
  if (!Array.isArray(sportsOffered)) return []
  return sportsOffered.filter((slug): slug is string => typeof slug === 'string')
}

// Figma "Rallye — Protótipo" (node 43:1221/133:1145): Dono/Admin usam o selo
// verde (default do Badge), Professor usa o selo azul. Qualquer outro role
// (Gestor, Aluno etc.) não aparece no frame — mantém o verde default.
function roleTone(role: string | null): 'success' | 'info' {
  return role === 'Professor' ? 'info' : 'success'
}

/**
 * S1 — Seletor de arena (BEAC-1681/1835). Reskin a partir do Figma "Rallye —
 * Protótipo" (frame "07 · Escolher Arena", canvases Auth — Mobile/Desktop):
 * sem hero no mobile (só título + subtítulo, como as demais telas de auth),
 * lista de `<ArenaCard>` (mesmo componente do DS já usado no login/troca de
 * arena — Figma node 126:289, a instância literal usada neste frame) em vez
 * da grade/CSS caseiro anterior.
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
        heroTitle="Bora pra quadra!"
        heroSubtitle="Escolha em qual arena você quer entrar agora."
        title="Escolha a arena"
        subtitle="Você joga em mais de um lugar — entra na que quiser agora."
        wide
      >
        {state.status === 'loading' && (
          <SkeletonGroup label="Carregando arenas">
            <div className="s1-skeleton-list">
              <Skeleton type="tableRow" />
              <Skeleton type="tableRow" />
              <Skeleton type="tableRow" />
            </div>
          </SkeletonGroup>
        )}

        {state.status === 'error' && (
          <div className="s1-error">
            <p>Não foi possível carregar suas arenas agora.</p>
            <Button type="button" variant="secondary" onClick={handleRetry}>
              Tentar novamente
            </Button>
          </div>
        )}

        {state.status === 'ready' && state.memberships.length === 0 && (
          <EmptyState
            icon={<Icon name="store" size={40} />}
            title={EMPTY_STATE_MESSAGE}
            actionLabel="Entrar com código de convite"
            onAction={handleOpenDialog}
          />
        )}

        {state.status === 'ready' && state.memberships.length > 0 && (
          <div className="s1-arena-list">
            {state.memberships.map((membership) => (
              <ArenaCard
                key={membership.unitId}
                testId={membership.unitId}
                name={membership.unit.name}
                subtitle={membership.unit.address ?? undefined}
                roles={membership.role ? [membership.role] : []}
                roleTone={roleTone(membership.role)}
                sports={sportSlugs(membership.unit.sportsOffered)}
                disabled={enteringUnitId !== null}
                onClick={() => void enterMembership(membership)}
              />
            ))}
          </div>
        )}

        {confirmation && (
          <p role="status" className="s1-confirmation">
            {confirmation}
          </p>
        )}

        {state.status !== 'loading' &&
          !(state.status === 'ready' && state.memberships.length === 0) && (
            <div className="s1-invite-row">
              <Button
                type="button"
                variant="soft"
                fullWidth
                icon={<span aria-hidden="true">+</span>}
                onClick={handleOpenDialog}
              >
                Entrar com código de convite
              </Button>
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
