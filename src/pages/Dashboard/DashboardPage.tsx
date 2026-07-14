// Stub de S1/Dashboard: a tela real nasce em outra story/worktree. Existe
// aqui só para a tela A4 (BEAC-1676) ter um destino real de redirect após a
// verificação de e-mail bem-sucedida.
export function DashboardPage() {
  return (
    <section>
      <h1>Dashboard</h1>
      <p>Email verificado com sucesso. (tela real fora do escopo desta story)</p>
    </section>
  )
}
