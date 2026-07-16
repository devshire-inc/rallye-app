import type { ReactNode } from 'react'
import './AppShell.css'

export interface AppShellProps {
  /** Rótulo de tenant/unit exibido no rodapé da sidebar (ex.: "Rede Areia
   * Dourada · 3 unidades"). */
  orgLabel: string
  /** Rótulo do usuário logado + papel (ex.: "Bruno Fernandes · Dono"). */
  userLabel: string
  children: ReactNode
}

/**
 * Shell mínima "PF3" (BEAC-1832, decisão 4 do relatório de execução de
 * BEAC-1680): sidebar + bottomnav no padrão `.app-shell`/`.sidebar`/
 * `.bottomnav` do protótipo real (ver scr-pf3/scr-ow2/scr-ow3 do artifact
 * "Rallye — Perfil & Config · Saque Noturno"). Escopo deliberadamente
 * mínimo — só o suficiente pra hospedar Perfil/OW2/OW3: os demais itens do
 * menu (Início, Agenda, Torneios, Loja, Gestão, Relatórios) aparecem
 * inertes (mesma opacidade/cursor do protótipo nestas telas), sem rota
 * própria — não é escopo desta story construí-los.
 */
export function AppShell({ orgLabel, userLabel, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          rallye<span className="dot">.</span>
        </div>
        <div className="side-item inert">Início</div>
        <div className="side-item inert">Agenda</div>
        <div className="side-item inert">Torneios</div>
        <div className="side-item inert">Loja</div>
        <div className="side-item active">Perfil</div>
        <div className="side-sep" />
        <div className="side-item inert">Gestão</div>
        <div className="side-item inert">Relatórios</div>
        <div className="side-foot">
          {orgLabel}
          <br />
          {userLabel}
        </div>
      </aside>
      <div className="shell-main">{children}</div>
      <nav className="bottomnav">
        <button className="bn-item" type="button" disabled>
          Início
        </button>
        <button className="bn-item" type="button" disabled>
          Agenda
        </button>
        <button className="bn-item" type="button" disabled>
          Torneios
        </button>
        <button className="bn-item" type="button" disabled>
          Loja
        </button>
        <button className="bn-item active" type="button" disabled>
          Perfil
        </button>
      </nav>
    </div>
  )
}
