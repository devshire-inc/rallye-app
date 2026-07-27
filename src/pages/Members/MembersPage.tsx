import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { listMembers, type Member } from '../../lib/api/members'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { RolePickerSheet } from './RolePickerSheet'
import '../../components/AuthLayout/AuthLayout.css'
import './MembersPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; members: Member[] }

/**
 * Tela de membros da unidade com atribuição de papel (BEAC-1845, story
 * BEAC-1686: "Aba Papéis em C3: atribuição de papel a usuário"). Sem
 * protótipo dedicado — construída seguindo os padrões visuais já
 * estabelecidos em dois Artifacts reais (lidos diretamente, não parafraseado
 * de memória, antes de implementar):
 *
 *   - "Rallye — Pessoas & Turmas · Saque Noturno"
 *     (claude.ai/code/artifact/bf7a3004-32ee-491a-84fa-80dd003c75ce),
 *     seção `id="scr-al1"`: padrão de linha de lista `.p-row` (linha
 *     clicável) > `.avatar-sm` (avatar de 2 letras) + `.pw` (`.nm` nome +
 *     `.mt` metadado secundário) + `.tail` (badge à direita). Debounce de
 *     300ms na busca — valor confirmado no próprio hint-note do protótipo
 *     ("Busca com debounce 300ms"), não um número escolhido à toa (ver
 *     useDebouncedValue). Adaptado aqui: o placeholder da busca NÃO copia o
 *     literal do protótipo ("Nome, e-mail ou telefone...") — "telefone"
 *     nunca fez parte do escopo desta story e busca por telefone não existe
 *     neste endpoint (correção de review de BEAC-1845); o placeholder real é
 *     "Nome ou e-mail...", refletindo exatamente os dois campos que
 *     `?q=` de fato cobre (ver api/internal/members/handler.go no backend e
 *     src/lib/api/members.ts). O badge em `.tail` mostra o nome do
 *     papel atual do membro (não um status ativo/inativo como AL1 usa) — por
 *     isso usa a variante neutra do badge (`.badge-neutral`), não
 *     `.b-success`/`.b-error` (que no protótipo real não têm CSS dedicado,
 *     só inline style — reproduzidas aqui como classes de verdade,
 *     `.badge-neutral`, já que este AC só precisa da neutra).
 *   - "Rallye — Perfil & Config · Saque Noturno"
 *     (claude.ai/code/artifact/3a67a9a8-70b7-4af1-bc1a-96dabfbc70a5), seção
 *     `id="scr-c3"`: como papéis de sistema vs. customizados são
 *     distinguidos visualmente (badge "Sistema") — reaproveitado no seletor
 *     de papel (RolePickerSheet.tsx), mesma classe `.role-row`/`.rn` que
 *     BEAC-1684's RolesPage já usa (não replicada aqui porque RolesPage não
 *     existe neste branch — BEAC-1684 é uma story irmã não mergeada — mas o
 *     NOME das classes é mantido igual, seguindo o protótipo diretamente, o
 *     que já garante consistência visual quando os dois branches forem
 *     reconciliados).
 *
 * Ponto de entrada: um novo item de menu em PF3 ("Membros e papéis", ver
 * ProfilePage.tsx) — decisão desta task. C3 (aba "Papéis" de BEAC-1684) não
 * existe neste branch para linkar "ao lado dela" (BEAC-1684 não está
 * mergeada); PF3 já é de onde BEAC-1684 linka sua própria tela de papéis
 * (mesmo padrão de link condicionado a `getActiveUnitId()`), então um novo
 * item ali mantém a mesma convenção de navegação sem exigir reproduzir a
 * tela inteira de C3 (fora do escopo de BEAC-1844/1845).
 *
 * Rota `/units/:unitId/members` (não `/tenants/:tenantId/...`): o endpoint
 * que esta tela consome (BEAC-1844) é unit-scoped por `{id}` no path, mesma
 * forma refletida na rota do frontend (mesmo padrão de RolesPage/BEAC-1684).
 */
export default function MembersPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [pickerMember, setPickerMember] = useState<Member | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request = unitId
        ? listMembers(unitId, debouncedQuery)
        : Promise.reject(new Error('missing_unit_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', members: result.members })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, debouncedQuery],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  function handleRoleChanged(updated: Member) {
    setPickerMember(null)
    setState((prev) => {
      if (prev.status !== 'ready') return prev
      return {
        status: 'ready',
        members: prev.members.map((m) => (m.membershipId === updated.membershipId ? updated : m)),
      }
    })
  }

  const members = state.status === 'ready' ? state.members : []

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to="/perfil">
          ‹ Perfil
        </Link>
        <h1>Membros</h1>
        <div className="spacer" />
        <div className="searchbar">
          <input
            type="text"
            placeholder="Nome ou e-mail..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar membro"
          />
        </div>
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <p role="status">Carregando membros…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar os membros desta arena.</p>
        ) : null}

        {state.status === 'ready' ? (
          <div className="ag-list">
            {members.length === 0 ? (
              <p className="hint">Nenhum membro encontrado.</p>
            ) : (
              members.map((member) => (
                <button
                  type="button"
                  key={member.membershipId}
                  className="p-row"
                  onClick={() => setPickerMember(member)}
                  data-testid={`member-row-${member.membershipId}`}
                >
                  <span className="avatar-sm">{initials(member.user.name)}</span>
                  <div className="pw">
                    <div className="nm">{member.user.name}</div>
                    {member.user.email ? <div className="mt">{member.user.email}</div> : null}
                  </div>
                  <div className="tail">
                    <span className="badge badge-neutral">
                      {member.role?.name ?? 'Sem papel'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <p className="hint-note">Busca com debounce 300ms · toque num membro para trocar o papel.</p>

      <BottomSheet
        open={pickerMember !== null}
        onClose={() => setPickerMember(null)}
        label="Trocar papel"
      >
        {pickerMember && unitId ? (
          <RolePickerSheet
            unitId={unitId}
            member={pickerMember}
            onSuccess={handleRoleChanged}
            onCancel={() => setPickerMember(null)}
          />
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}

/** Iniciais de 2 letras a partir do nome (mesmo padrão de `.avatar-sm` do
 * protótipo real, ex.: "Marina Costa" -> "MC"). Nome com uma palavra só usa
 * as 2 primeiras letras dela. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
