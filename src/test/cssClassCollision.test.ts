/* TRAVA — colisão de classe nua entre CSS de tela e CSS do design system.
 *
 * O defeito que este teste impede: uma tela declara uma classe NUA (ex.
 * `.card`) que um componente de `src/components/ui` também declara. As duas
 * regras têm especificidade (0,1,0), o bundle de produção é um arquivo só, e
 * quem carrega por último vence — na prática a tela, porque o CSS de página
 * costuma entrar depois. O componente passa a renderizar errado em TODO o
 * app, não só na tela que declarou.
 *
 * Já aconteceu com `.card`, `.menu-list`, `.chip`, `.ptabs`, `.toast`,
 * `.badge`, `.empty-state`, `.menu-row` e `.plan-card` — nove vezes. O
 * Storybook não pega nenhuma delas: ele carrega só o CSS do componente, então
 * lá o componente está sempre certo. Só aparece no app real.
 *
 * A REGRA: a classe nua pertence ao componente do design system. Quem tem que
 * renomear é a tela.
 *
 * O que NÃO é acusado — sobrescrita escopada por ancestral, que é deliberada e
 * mais específica:
 *     `.withdraw-sheet .toast`   (0,2,0) — escopo próprio da folha
 *     `.rnk-page .card`          (0,2,0) — reafirma valor só naquela página
 *     `.dash-body.shop-body`     (0,2,0) — compound com outra classe
 *     `div.card`                 (0,1,1) — qualificado por tipo
 * Esse é o escape hatch: para mexer numa classe do design system, escope.
 */
import { globSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bareClassOf, bareClassesInFile, hasCombinator, splitSelectorList } from './cssBareClasses'

/* Exceções. Cada entrada precisa de justificativa aqui do lado — nunca uma
 * exclusão silenciosa. Nasceu vazia e deve continuar assim: uma colisão nova
 * se resolve renomeando a classe da tela, não adicionando uma linha aqui. */
const ALLOWLIST: { className: string; file: string; reason: string }[] = []

const DS_DIR = 'src/components/ui/'

/* `*.stories.css` fica de fora dos DOIS lados, e isso é deliberado: essas
 * folhas são importadas só pelas stories do Storybook, nunca pelo app, então
 * não entram no bundle de produção e não podem colidir com nada nele. */
const cssFiles = globSync('src/**/*.css').filter((file) => !file.endsWith('.stories.css'))

const designSystemFiles = cssFiles.filter((file) => file.startsWith(DS_DIR))
/* Lado "tela": páginas + os componentes de app que não são do design system.
 * `src/index.css`, `src/App.css` e `src/styles/**` ficam de fora porque são as
 * folhas globais/tokens, onde uma classe genérica é legítima por definição. */
const screenFiles = cssFiles.filter(
  (file) =>
    file.startsWith('src/pages/') ||
    (file.startsWith('src/components/') && !file.startsWith(DS_DIR)),
)

describe('extrator de classe nua', () => {
  /* O extrator é a parte que pode errar em silêncio, então ele é testado
   * contra os seletores difíceis que existem de fato neste repositório —
   * todos copiados de arquivos reais, não inventados. */
  it.each([
    // caso real -> classe nua declarada (ou null)
    ['.toast', 'toast'],
    ['.menu-row:last-child', 'menu-row'], // SettingsPage.css
    ['.plan-card:hover', 'plan-card'], // PlanosListPage.css
    ['.btn-danger:hover:not(:disabled)', 'btn-danger'], // Loja.css
    ['.card::before', 'card'],
    ['.empty-state:where(.x)', 'empty-state'], // :where() não muda especificidade
    ['.withdraw-sheet .toast', null], // WithdrawSheet.css — escopado
    ['.rnk-page .card', null], // RankingsPage.css — escopado
    ['.dash-body.dash-body--wide:has(table)', null], // DashboardPage.css — compound
    ['.dash-body.shop-body:has(.shop-checkout-card) > .button', null], // Loja.css
    ['button.menu-row', null], // MenuRow.css — qualificado por tipo
    ['.report-table td:not(:first-child)', null], // ReportsPage.css — descendente
    ['.rnk-row__name .badge', null], // RankingsPage.css — escopado
    ["[data-theme='dark'] .auth-shell__badge", null], // AuthLayout.css
    ['.cat-row .cn', null],
    ['#id', null],
    ['[data-theme="dark"]', null],
  ])('%s', (selector, expected) => {
    expect(bareClassOf(selector)).toBe(expected)
  })

  it('quebra lista de seletores na vírgula de topo, não na de dentro de :has()/[]', () => {
    expect(splitSelectorList('.a, .b')).toEqual(['.a', '.b'])
    expect(splitSelectorList('.dash-body:has(.a, .b), .c')).toEqual([
      '.dash-body:has(.a, .b)',
      '.c',
    ])
    expect(splitSelectorList('[data-x="a,b"], .c')).toEqual(['[data-x="a,b"]', '.c'])
    expect(splitSelectorList('\n  .a,\n  .b\n')).toEqual(['.a', '.b'])
  })

  it('não confunde combinador de verdade com espaço dentro de () ou []', () => {
    expect(hasCombinator('.a .b')).toBe(true)
    expect(hasCombinator('.a > .b')).toBe(true)
    expect(hasCombinator('.a:has(.b > .c)')).toBe(false)
    expect(hasCombinator('[data-x="a b"]')).toBe(false)
  })

  it('lê seletor dentro de @media e de regra aninhada, e ignora @keyframes', () => {
    // Casos reais: `.dash-body` dentro de @media (DashboardPage.css) e `&:hover`
    // aninhado (App.css). `from`/`to` de @keyframes não são seletor de elemento.
    const found = bareClassesInFile('src/App.css').map((d) => d.selector)
    expect(found.some((s) => s.includes(':hover'))).toBe(true)
    expect(found.some((s) => /^\d|^from$|^to$/.test(s))).toBe(false)
  })

  it('acha as declarações nuas de um componente real do design system', () => {
    const found = bareClassesInFile('src/components/ui/Card/Card.css')
    expect(found.map((d) => d.className)).toContain('card')
    // `.card--interactive:hover` é nu (é a mesma classe, em estado)
    expect(found.map((d) => d.className)).toContain('card--interactive')
  })
})

describe('nenhuma tela redeclara classe nua do design system', () => {
  it('src/pages e src/components (fora de ui/) não colidem com src/components/ui', () => {
    const owners = new Map<string, string[]>()
    for (const file of designSystemFiles) {
      for (const declaration of bareClassesInFile(file)) {
        const list = owners.get(declaration.className) ?? []
        if (!list.includes(file)) list.push(file)
        owners.set(declaration.className, list)
      }
    }

    const collisions: string[] = []
    for (const file of screenFiles) {
      for (const declaration of bareClassesInFile(file)) {
        const ownerFiles = owners.get(declaration.className)
        if (!ownerFiles) continue
        if (
          ALLOWLIST.some(
            (entry) => entry.className === declaration.className && entry.file === declaration.file,
          )
        ) {
          continue
        }
        collisions.push(
          [
            `.${declaration.className} — colisão de classe nua`,
            `  componente (dono da classe): ${ownerFiles.join(', ')}`,
            `  tela (precisa renomear):     ${declaration.file}:${declaration.line}  {${declaration.selector}}`,
            `  A classe nua .${declaration.className} pertence ao componente do design system.`,
            `  Renomeie a classe DA TELA para um nome próprio (ex.: .${prefixSuggestion(declaration.file)}-${declaration.className})`,
            `  mantendo as MESMAS declarações, e atualize o .tsx que a consome.`,
            `  Se a tela dependia de herdar declarações do componente, copie-as para a regra nova`,
            `  — sem isso a tela muda de aparência. Precedente: 5fac500 (.toast -> .nrs-notice).`,
            `  Alternativa legítima quando a intenção É sobrescrever o componente naquela tela:`,
            `  escopar por um ancestral próprio (ex.: .minha-pagina .${declaration.className}).`,
          ].join('\n'),
        )
      }
    }

    expect(collisions, `\n\n${collisions.join('\n\n')}\n`).toEqual([])
  })
})

/** Sugestão de prefixo a partir do nome do arquivo da tela, só para a mensagem. */
function prefixSuggestion(file: string): string {
  const base = file
    .split('/')
    .pop()!
    .replace(/\.css$/, '')
  return base
    .replace(/Page$|Sheet$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}
