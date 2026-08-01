import { useEffect, useState } from 'react'
import { listMyMemberships } from '../lib/api'
import { getMe } from '../lib/api/me'
import { getActiveUnitId } from '../lib/tenantContext'

export interface ShellIdentity {
  /** Nome real da unit ativa (ex.: "Arena Areia Dourada") — vazio até o
   * primeiro fetch resolver. */
  orgLabel: string
  /** "{full_name} · {roleLabel}" real, ou só o nome quando role é null. */
  userLabel: string
  /** Role BRUTO da membership ativa (ex.: "Tenant Owner", "Aluno") — não o
   * rótulo colapsado usado em userLabel. É o que BEAC-2058 (roteamento de
   * nav por papel) precisa pra decidir entre AG1/AG3/AG4 etc. */
  role: string | null
  /** `true` enquanto GET /me + GET /me/memberships estão em voo; `false` em
   * QUALQUER caminho terminal — sucesso, resposta `!ok` ou erro de rede.
   * Existe porque `role: null` sozinho é ambíguo: significa tanto "ainda não
   * sei" quanto "este usuário realmente não tem papel nesta unit". Quem
   * DESPACHA por papel (renderiza tela/rota diferente por role) precisa
   * distinguir os dois; quem só EXIBE `orgLabel`/`userLabel` pode continuar
   * ignorando este campo — a string vazia já é o estado neutro correto. */
  loading: boolean
}

const EMPTY_IDENTITY = { orgLabel: '', userLabel: '', role: null } as const

/** Estado inicial e também o de erro: sem dados, mas já resolvido. */
const RESOLVED_EMPTY: ShellIdentity = { ...EMPTY_IDENTITY, loading: false }
const LOADING_IDENTITY: ShellIdentity = { ...EMPTY_IDENTITY, loading: true }

/**
 * Roles admin-tier do seed de sistema (migrations/000016_seed_system_roles)
 * — Platform Admin/Tenant Owner/Unit Admin todos colapsam pro mesmo rótulo
 * "Admin" no userLabel (AC de BEAC-2080). Mesma simplificação já aceita em
 * S1Page.roleBadgeClass, que também trata só 'Admin'/'Professor'/'Aluno'
 * como rótulos conhecidos — userLabel é um resumo compacto, não o nome
 * completo do papel.
 */
const ADMIN_TIER_ROLES = new Set(['Platform Admin', 'Tenant Owner', 'Unit Admin'])

function roleLabelFor(role: string | null): string | null {
  if (role === null) return null
  if (ADMIN_TIER_ROLES.has(role)) return 'Admin'
  return role
}

function userLabelFor(fullName: string, role: string | null): string {
  const label = roleLabelFor(role)
  return label ? `${fullName} · ${label}` : fullName
}

/**
 * useShellIdentity (BEAC-2080, story BEAC-2057): combina GET /me (full_name,
 * BEAC-2078), GET /me/memberships (unit.name + role por membership,
 * existente) e getActiveUnitId() (existente, tenantContext.ts) pra produzir
 * os dados reais que AppShell precisa — substitui os literais hardcoded
 * (`orgLabel="Arena Areia Dourada"`, `userLabel="Rafael Andrade · Admin"`)
 * presentes em ~48 páginas hoje.
 *
 * Antes do primeiro fetch resolver (ou em erro de rede) devolve os campos
 * vazios — mesma postura "sem estado liberado por omissão" adotada em
 * usePermission. O que separa os dois casos é `loading`: `true` só enquanto
 * os fetches estão em voo, `false` assim que qualquer desfecho chega
 * (inclusive erro — erro NÃO fica preso em "carregando pra sempre").
 */
export function useShellIdentity(): ShellIdentity {
  const [identity, setIdentity] = useState<ShellIdentity>(LOADING_IDENTITY)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [meResult, memberships] = await Promise.all([
        getMe().catch(() => ({ ok: false as const, status: 0, error: 'network_error' })),
        listMyMemberships().catch(() => []),
      ])
      if (cancelled) return
      if (!meResult.ok) {
        // Best-effort como antes (identidade vazia), mas resolvido: quem
        // despacha por papel precisa sair do estado de carregamento.
        setIdentity(RESOLVED_EMPTY)
        return
      }

      const activeUnitId = getActiveUnitId()
      const activeMembership =
        memberships.find((m) => m.unitId === activeUnitId) ?? memberships[0]

      setIdentity({
        orgLabel: activeMembership?.unit.name ?? '',
        userLabel: userLabelFor(meResult.fullName, activeMembership?.role ?? null),
        role: activeMembership?.role ?? null,
        loading: false,
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return identity
}
