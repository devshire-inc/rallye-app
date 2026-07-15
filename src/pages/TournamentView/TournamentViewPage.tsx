import { useParams, useSearchParams } from 'react-router-dom'
import { TemporarySessionBanner } from '../../components/TemporarySessionBanner/TemporarySessionBanner'
import './TournamentViewPage.css'

/**
 * Stub da visão pública/leitura de um torneio — a tela real pertence ao
 * Épico 8 (Torneios e Campeonatos), ainda não construído. Existe aqui só
 * como destino de navegação para os 3 caminhos da A5 (BEAC-1821/1822):
 *   1. "Apenas visualizar": chega aqui sem sessão nenhuma — nenhum banner.
 *   2. Etapa 2 verificada com sucesso: chega aqui com a sessão temporária
 *      ativa (notifications=1) — banner de conversão sempre visível.
 *   3. Torneio em si é só um UUID solto por ora (ver decisão de modelagem
 *      de BEAC-1818: sem tabela `tournaments` ainda).
 */
export function TournamentViewPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [searchParams] = useSearchParams()
  const notificationsEnabled = searchParams.get('notifications') === '1'

  return (
    <section className="tournament-view-page">
      <TemporarySessionBanner tournamentId={tournamentId} />
      <h1>Torneio {tournamentId}</h1>
      <p>Visão pública de leitura do torneio (tela real fora do escopo desta story — Épico 8).</p>
      {notificationsEnabled && <p role="status">Notificações ativadas para este torneio.</p>}
    </section>
  )
}
