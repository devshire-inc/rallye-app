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

/** App.css — boilerplate do template Vite, não importado por nenhuma
 * página do app; mantido aqui só porque a query existe no arquivo. */
export const BREAKPOINT_VITE_TEMPLATE_MAX = 1024

/** DayUseConfigPage.css — form-grid empilha em 1 coluna abaixo disso. */
export const BREAKPOINT_DAYUSE_FORM_STACK_MAX = 620

/** TournamentFormPage.css — ajuste de layout compacto em telas bem estreitas. */
export const BREAKPOINT_TOURNAMENT_FORM_COMPACT_MAX = 480
