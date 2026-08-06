import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { invalidateIdentity } from '../lib/query/identity'
import { getActiveTenantId, getActiveUnitId, setSelectedUnitId } from '../lib/tenantContext'
import './TrocarArenaPage.css'

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

// Mesmo mapeamento de role -> tom de selo do S1Page (Figma node 43:1221/133:1145).
function roleTone(role: string | null): 'success' | 'info' {
  return role === 'Professor' ? 'info' : 'success'
}

/**
 * "05 · Trocar de Arena" (BEAC-1835), alcançada pelo seletor de arena no
 * rodapé da sidebar de AppShell (any tela do app) ou pela rota
 * `/trocar-arena`. Reskin a partir do Figma "Rallye — Protótipo" (frame "05
 * · Trocar de Arena", nodes 51:1718 mobile / 129:3273 desktop).
 *
 * Diferente de S1Page (`/s1`, mesmo `<ArenaCard>` porém sob `AuthLayout`,
 * fluxo de onboarding pré-sessão), este frame mostra o chrome real do app
 * (Sidebar/BottomNav de `AppShell`, breadcrumb "Perfil > Trocar de Arena")
 * — decisão de mapeamento: tela própria, não reaproveita `AuthLayout` (ver
 * resumo da tarefa). Reaproveita 1:1 a lógica de negócio de S1Page (mesmas
 * chamadas `listMyMemberships`/`accessMembership`/`dashboardPathForRole`),
 * SEM o pulo automático de "só 1 membership" (aqui o usuário já está
 * "dentro" de uma arena — a lista sempre aparece, mesmo com 1 item, pra
 * mostrar o selo "Você está aqui").
 */
export default function TrocarArenaPage() {
  const navigate = useNavigate()
  const { refetch: refetchPermissions } = usePermissionsContext()
  const queryClient = useQueryClient()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [enteringUnitId, setEnteringUnitId] = useState<string | null>(null)

  const activeUnitId = getActiveUnitId()
  const tenantId = getActiveTenantId()

  // Mesma ordem de S1Page.enterMembership: bookkeeping best-effort, refetch
  // de permissions da NOVA unit, só então navega.
  const enterMembership = useCallback(
    async (membership: MembershipListItem) => {
      setEnteringUnitId(membership.unitId)
      // Marca a arena escolhida antes de QUALQUER chamada desta troca. As
      // duas abaixo saem de `/s1`/`/trocar-arena`, rotas sem `/units/` no
      // path, então é esta seleção persistida que decide o `X-Rallye-Unit`
      // que elas levam (ver getRequestUnitId em ../lib/tenantContext.ts).
      // Sem isto, quem tem 2+ memberships continuaria tomando `409
      // arena_selection_required` justamente na chamada que decide o gating
      // da arena nova.
      setSelectedUnitId(membership.unitId)
      try {
        await accessMembership(membership.unitId)
      } catch {
        // best-effort — ver comentário acima.
      }
      // Mesma invalidação de identidade de S1Page.enterMembership (ver o
      // comentário detalhado lá): o cache de me/memberships/permissions da
      // arena ANTERIOR não pode sobreviver à troca.
      void invalidateIdentity(queryClient)
      await refetchPermissions()
      navigate(dashboardPathForRole(membership.role, membership.unitId), { replace: true })
    },
    [navigate, queryClient, refetchPermissions],
  )

  const loadInitial = useCallback((onCancelled: () => boolean) => {
    listMyMemberships()
      .then((memberships) => {
        if (onCancelled()) return
        setState({ status: 'ready', memberships })
      })
      .catch(() => {
        if (!onCancelled()) setState({ status: 'error' })
      })
  }, [])

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

  async function refetchAfterRedeem() {
    try {
      const memberships = await listMyMemberships()
      setState({ status: 'ready', memberships })
    } catch {
      // best-effort — ver comentário de S1Page.refetchAfterRedeem.
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
    <>
      <div className="trocar-arena-page">
        <nav className="trocar-arena-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="trocar-arena-breadcrumb__link" onClick={() => navigate('/perfil')}>
            Perfil
          </button>
          <Icon name="chevron-right" size={10} />
          <span>Trocar de Arena</span>
        </nav>

        <button
          type="button"
          className="trocar-arena-back"
          aria-label="Voltar"
          onClick={() => navigate(-1)}
        >
          <Icon name="chevron-left" />
        </button>

        <div className="trocar-arena-heading">
          <h1>Trocar de arena</h1>
          <p>Você joga em mais de uma arena — troque quando quiser.</p>
        </div>

        {state.status === 'loading' && (
          <SkeletonGroup label="Carregando arenas">
            <div className="trocar-arena-skeleton-list">
              <Skeleton type="tableRow" />
              <Skeleton type="tableRow" />
              <Skeleton type="tableRow" />
            </div>
          </SkeletonGroup>
        )}

        {state.status === 'error' && (
          <div className="trocar-arena-error">
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
          <div className="trocar-arena-list">
            {state.memberships.map((membership) => {
              const isCurrent = membership.unitId === activeUnitId
              const roles = membership.role
                ? isCurrent
                  ? [membership.role, 'Você está aqui']
                  : [membership.role]
                : []
              return (
                <ArenaCard
                  key={membership.unitId}
                  testId={membership.unitId}
                  name={membership.unit.name}
                  subtitle={membership.unit.address ?? undefined}
                  roles={roles}
                  roleTone={roleTone(membership.role)}
                  sports={sportSlugs(membership.unit.sportsOffered)}
                  current={isCurrent}
                  disabled={enteringUnitId !== null}
                  onClick={() => void enterMembership(membership)}
                />
              )
            })}
          </div>
        )}

        {confirmation && (
          <p role="status" className="trocar-arena-confirmation">
            {confirmation}
          </p>
        )}

        {state.status !== 'loading' &&
          !(state.status === 'ready' && state.memberships.length === 0) && (
            <div className="trocar-arena-actions">
              <Button
                type="button"
                variant="soft"
                fullWidth
                icon={<span aria-hidden="true">+</span>}
                onClick={handleOpenDialog}
              >
                Entrar com código de convite
              </Button>
              {tenantId && (
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  icon={<span aria-hidden="true">+</span>}
                  onClick={() => navigate(`/tenants/${tenantId}/units/new`)}
                >
                  Cadastrar minha arena
                </Button>
              )}
            </div>
          )}
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        label="Entrar em nova arena"
      >
        <EnterArenaSheet
          onSuccess={handleInviteRedeemed}
          codeInputId="trocarArenaCode"
          submitButtonId="trocarArenaDialogConfirm"
        />
      </BottomSheet>
    </>
  )
}
