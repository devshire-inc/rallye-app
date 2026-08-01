/**
 * Fonte única de verdade dos breakpoints ad hoc já em uso no CSS do app
 * (BEAC-1741). `var()` do CSS não funciona dentro da condição de uma
 * `@media` — limitação real da spec, não deste projeto — então as
 * `@media` queries continuam usando o valor literal em px, mas cada uma
 * referencia esta constante em comentário como fonte canônica. Qualquer
 * lógica JS/React que precise de `matchMedia`/resize deve importar daqui,
 * nunca hardcodar o número de novo.
 */

/** S1Page.css — grade de arenas vira 2 colunas a partir de tablet. */
export const BREAKPOINT_TABLET_MIN = 640

/** AppShell.css — troca sidebar (desktop) / bottom-nav (mobile). */
export const BREAKPOINT_SHELL_DESKTOP_MIN = 860

/** Padrão "tabela no desktop" — ponto em que uma tela troca os cards
 * (mobile) por uma `<table>` de 5 colunas. Deliberadamente MAIOR que
 * BREAKPOINT_SHELL_DESKTOP_MIN: a 860px a sidebar já apareceu, mas a coluna
 * de conteúdo ainda é estreita demais pra tabela, que virava rolagem
 * horizontal com a coluna de ação fora da viewport.
 *
 * Valor medido (F5 Minhas Faturas, Chromium), não arbitrado:
 * - o cromo do shell consome 400px fixos no desktop — sidebar 288
 *   (`Sidebar` 256 + `.shell-sidebar-wrapper` 2×16), `.shell-main` 2×32 e
 *   `.dash-body` 2×24 — logo, largura útil = viewport − 400;
 * - com as larguras de coluna do Figma (36/14/16/15/19%), a coluna DATA
 *   (`white-space: nowrap`, "venceu 10/07/2026") é a que trava: ela só para
 *   de transbordar a célula a partir de 820px de largura útil (em 810 ainda
 *   sobra 3px). DESCRIÇÃO é a única coluna que trunca por design (ellipsis).
 * - 820 + 400 = 1220. Ver `.invoice-table__table { min-width: 820px }` em
 *   Financeiro.css, o mesmo 820 do outro lado da conta.
 *
 * Também é o breakpoint do utilitário `.dash-body--wide`
 * (src/styles/utilities.css), que solta a coluna de 560px onde há tabela. */
export const BREAKPOINT_TABLE_MIN = 1220

/** App.css — boilerplate do template Vite, não importado por nenhuma
 * página do app; mantido aqui só porque a query existe no arquivo. */
export const BREAKPOINT_VITE_TEMPLATE_MAX = 1024

/** DayUseConfigPage.css — form-grid empilha em 1 coluna abaixo disso. */
export const BREAKPOINT_DAYUSE_FORM_STACK_MAX = 620

/** TournamentFormPage.css — ajuste de layout compacto em telas bem estreitas. */
export const BREAKPOINT_TOURNAMENT_FORM_COMPACT_MAX = 480
