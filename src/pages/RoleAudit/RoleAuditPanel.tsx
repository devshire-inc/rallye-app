import { useCallback, useEffect, useState } from 'react'
import { formatRelativeTimestamp } from '../../lib/formatRelativeTimestamp'
import { listRoleAuditLog, type RoleAuditEntry } from '../../lib/api/roleAudit'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'

const PAGE_SIZE = 20

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready' }

/**
 * Conteúdo da aba "Histórico" de C3 (BEAC-1848, story BEAC-1687: "Aba
 * Auditoria em C3: timeline de mudanças de papel"), hospedado por
 * RolesPage.tsx (aba `historico`) ao lado da aba "Papéis" (BEAC-1684) — a
 * mesma tela única com 2 abas do protótipo real. Antes da reconciliação do
 * Épico 3, esta tela existia como página standalone própria (rota
 * `/units/:unitId/role-audit-log` + item de menu PF3 "Histórico"), porque
 * BEAC-1687 foi construída num branch isolado sem visibilidade da estrutura
 * de abas que BEAC-1684 já tinha criado — o próprio código na época
 * documentava isso como "item de integração no merge dos dois branches, não
 * algo resolvido por esta task". Extraído aqui como painel puro (sem
 * AppShell/cabeçalho de página, que agora vêm de RolesPage) exatamente para
 * fazer essa integração — só um `<RoleAuditPanel unitId={unitId} />` dentro
 * do `ptab-panel` de `historico`, sem duplicar cabeçalho/rota/item de menu.
 *
 * Protótipo real lido diretamente antes de implementar (herdado de
 * RoleAuditPage.tsx original) — Artifact "Rallye — Perfil & Config"
 * (claude.ai/code/artifact/3a67a9a8-70b7-4af1-bc1a-96dabfbc70a5), seção
 * `id="scr-c3"`, `data-pp="auditoria"` (linhas ~961-968 do HTML da seção):
 *
 *   - Toast neutro no topo, cópia EXATA: "Prioridade MVP — rastreabilidade
 *     em caso de disputa sobre quem autorizou o quê." (ícone `i-clock` no
 *     protótipo — omitido: este app não tem esse ícone no sprite
 *     `public/icons.svg`, decisão já tomada por BEAC-1687, preservada aqui).
 *     Usa a classe `.toast-neutral` sozinha (sem `.toast`) — mesmo padrão
 *     de RolesPage/MembersPage: a classe genérica `.toast` (Toast.css) é
 *     `position:fixed` (banner de canto, dispensável/clicável), incompatível
 *     com um banner inline de conteúdo. A versão original de RoleAuditPage
 *     usava `"toast toast-neutral"` (as duas classes) com um `.toast` local
 *     redefinido em RoleAuditPage.css sem `position:fixed` — funcionava só
 *     por depender da ordem de import entre esse CSS e o Toast.css global
 *     não conflitar; corrigido aqui adotando o mesmo padrão já comprovado
 *     seguro de RolesPage (uma classe só, sem ambiguidade de cascata).
 *   - `.timeline` de `.tl-item.done`, cada um com uma linha em negrito
 *     "<ator> <verbo> <alvo>: <antes> → <depois>" e uma linha secundária de
 *     timestamp relativo ("hoje, 09:14"/"ontem, 16:40") ou absoluto ("3 de
 *     julho, 11:02") para entradas mais antigas.
 *   - Nenhuma ação de editar/excluir em lugar nenhum da aba — imutabilidade
 *     visual espelhando a imutabilidade real do backend (BEAC-1846: sem
 *     endpoint de UPDATE/DELETE, mais trigger de defesa em profundidade).
 *
 * O texto em negrito de cada entrada (`entry.text`) já vem PRONTO do
 * backend (roleaudit.formatEntry, BEAC-1847) — o verbo usado é "alterou o
 * papel de"/"atribuiu o papel de", não "promoveu"/"rebaixou" como o exemplo
 * do protótipo (o schema de roles não tem campo de hierarquia/nível) —
 * decisão confirmada explicitamente pelo usuário na reconciliação do épico,
 * mantendo o verbo neutro. A ESTRUTURA da linha (ator + verbo + alvo + ":" +
 * antes → depois) continua a mesma do protótipo.
 *
 * O protótipo real tem outros tipos de entrada no mesmo `.timeline` (ex.:
 * criação de papel, alteração de permissão) — o endpoint que esta tela
 * consome (GET /units/{id}/role-audit-log, BEAC-1847) filtra
 * deliberadamente só entity_type='membership_role'; a tabela genérica
 * public.audit_log (BEAC-1846) suportaria os outros tipos, mas nenhum
 * código deste repositório escreve esses outros eventos ainda — subconjunto
 * real de escopo, não um gap desta implementação.
 *
 * Paginação: "Carregar mais" (não scroll infinito automático).
 */
export default function RoleAuditPanel({ unitId }: { unitId: string | undefined }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [entries, setEntries] = useState<RoleAuditEntry[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadFirstPage = useCallback(
    (onCancelled: () => boolean) => {
      // Vira uma Promise rejeitada em vez de um `if` com setState síncrono
      // no corpo do efeito (mesmo padrão de RolesPage.tsx/MembersPage.tsx)
      // — toda atualização de estado acontece de forma assíncrona, dentro
      // de .then()/.catch().
      const request = unitId
        ? listRoleAuditLog(unitId, { limit: PAGE_SIZE })
        : Promise.reject(new Error('missing_unit_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setEntries(result.entries)
          setNextOffset(result.nextOffset)
          setState({ status: 'ready' })
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
    loadFirstPage(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadFirstPage])

  async function handleLoadMore() {
    if (!unitId || nextOffset === null || loadingMore) return
    setLoadingMore(true)
    const result = await listRoleAuditLog(unitId, { limit: PAGE_SIZE, offset: nextOffset })
    setLoadingMore(false)
    if (!result.ok) return
    setEntries((prev) => [...prev, ...result.entries])
    setNextOffset(result.nextOffset)
  }

  return (
    <>
      <div className="toast-neutral">
        <span>Prioridade MVP — rastreabilidade em caso de disputa sobre quem autorizou o quê.</span>
      </div>

      {state.status === 'loading' ? <PageLoading label="Carregando histórico" variant="list" /> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar o histórico desta arena.</p>
      ) : null}

      {state.status === 'ready' ? (
        entries.length === 0 ? (
          <p className="hint">Nenhuma mudança de papel registrada ainda.</p>
        ) : (
          <div className="timeline">
            {entries.map((e) => (
              <div className="tl-item done" key={e.id} data-testid={`audit-entry-${e.id}`}>
                <span className="tld" />
                <div className="tlt">
                  <b>{e.text}</b>
                  <span>{formatRelativeTimestamp(e.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {nextOffset !== null ? (
        <button type="button" className="load-more" onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}
    </>
  )
}
