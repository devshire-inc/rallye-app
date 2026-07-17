import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { formatRelativeTimestamp } from '../../lib/formatRelativeTimestamp'
import { listRoleAuditLog, type RoleAuditEntry } from '../../lib/api/roleAudit'
import '../../components/AuthLayout/AuthLayout.css'
import './RoleAuditPage.css'

const PAGE_SIZE = 20

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready' }

/**
 * Aba "Histórico" de C3 (BEAC-1848, story BEAC-1687: "Aba Auditoria em C3:
 * timeline de mudanças de papel"). Protótipo real lido diretamente antes de
 * implementar — Artifact "Rallye — Perfil & Config"
 * (claude.ai/code/artifact/3a67a9a8-70b7-4af1-bc1a-96dabfbc70a5), seção
 * `id="scr-c3"`, `data-pp="auditoria"` (linhas ~961-968 do HTML da seção):
 *
 *   - Toast neutro no topo, cópia EXATA: "Prioridade MVP — rastreabilidade
 *     em caso de disputa sobre quem autorizou o quê." (ícone `i-clock` no
 *     protótipo — omitido aqui: este app não tem o sprite de ícones do
 *     protótipo, `public/icons.svg`, só define bluesky/discord/github/x/
 *     documentation/social; nenhuma story irmã deste épico introduziu um
 *     `i-clock` real ainda — decisão desta task: texto sem ícone em vez de
 *     inventar um substituto visual não pedido pelo AC).
 *   - `.timeline` de `.tl-item.done`, cada um com uma linha em negrito
 *     "<ator> <verbo> <alvo>: <antes> → <depois>" e uma linha secundária de
 *     timestamp relativo ("hoje, 09:14"/"ontem, 16:40") ou absoluto ("3 de
 *     julho, 11:02") para entradas mais antigas.
 *   - Nenhuma ação de editar/excluir em lugar nenhum da aba — immutabilidade
 *     visual espelhando a imutabilidade real do backend (BEAC-1846: sem
 *     endpoint de UPDATE/DELETE, mais trigger de defesa em profundidade).
 *
 * O texto em negrito de cada entrada (`entry.text`) já vem PRONTO do
 * backend (roleaudit.formatEntry, BEAC-1847) — o verbo usado é "alterou o
 * papel de"/"atribuiu o papel de", não "promoveu"/"rebaixou" como o
 * exemplo do protótipo: o schema de roles não tem nenhum campo de
 * hierarquia/nível, então o backend não pode calcular se uma troca foi uma
 * promoção ou um rebaixamento sem arriscar rotular errado — ver comentário
 * de formatEntry no backend. A ESTRUTURA da linha (ator + verbo + alvo +
 * ":" + antes → depois) continua a mesma do protótipo.
 *
 * O protótipo real tem outros tipos de entrada no mesmo `.timeline` (ex.:
 * "Rafael Andrade criou o papel \"Gerente Financeiro\"", "Rafael Andrade
 * removeu \"config.gerenciar_roles\" de Carlos Mendes") — eventos de
 * criação de papel / alteração de permissão, não de troca de papel de
 * membership. O endpoint que esta tela consome (GET
 * /units/{id}/role-audit-log, BEAC-1847) filtra deliberadamente só
 * entity_type='membership_role' (ver comentário de pacote do backend) — a
 * tabela genérica public.audit_log (BEAC-1846) suportaria os outros tipos,
 * mas nenhum código deste repositório escreve esses outros eventos ainda.
 * Por isso esta tela mostra um SUBCONJUNTO do que o protótipo exibe (só
 * troca de papel) — não um gap desta implementação, e sim escopo real desta
 * story dentro do épico (as outras origens de auditoria não foram
 * construídas por nenhuma story ainda).
 *
 * Paginação: "Carregar mais" (não scroll infinito automático) — mais simples
 * de testar e implementar, atende o AC ("scroll/paginação pra históricos
 * longos") sem introduzir observers/scroll listeners que o AC não pediu
 * explicitamente.
 *
 * Rota `/units/:unitId/role-audit-log` (não uma sub-rota de uma C3
 * completa): esta aba "Histórico" vive ao lado da aba "Papéis" já
 * construída por BEAC-1684 (branch feature/beac-1684-custom-roles-crud,
 * RolesPage.tsx) — mas aquele branch não está mergeado neste worktree, e
 * portanto a estrutura de abas de C3 não existe aqui para hospedar esta
 * tela como uma aba real. Mesma situação de BEAC-1845 com a tela de
 * Membros: uma página standalone por enquanto — reconciliar como aba real
 * de C3 ao lado de "Papéis" é um item de integração no merge dos dois
 * branches, não algo resolvido por esta task.
 */
export default function RoleAuditPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [entries, setEntries] = useState<RoleAuditEntry[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadFirstPage = useCallback(
    (onCancelled: () => boolean) => {
      // Vira uma Promise rejeitada em vez de um `if` com setState síncrono
      // no corpo do efeito (mesmo padrão de MembersPage.tsx, BEAC-1845) —
      // toda atualização de estado acontece de forma assíncrona, dentro de
      // .then()/.catch().
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
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
      <div className="pg-head">
        <Link className="back" to="/perfil">
          ‹ Perfil
        </Link>
        <h1>Histórico</h1>
        <div className="spacer" />
      </div>

      <div className="dash-body">
        <div className="toast toast-neutral">
          <span>
            Prioridade MVP — rastreabilidade em caso de disputa sobre quem autorizou o quê.
          </span>
        </div>

        {state.status === 'loading' ? <p role="status">Carregando histórico…</p> : null}
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
          <button
            type="button"
            className="load-more"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </button>
        ) : null}
      </div>

      <p className="hint-note">
        Registro de auditoria imutável — sem edição ou exclusão, nesta tela ou em qualquer outra.
      </p>
    </AppShell>
  )
}
