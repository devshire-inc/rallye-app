/* Extrator de "classes nuas" declaradas em arquivos CSS.
 *
 * Uma classe é declarada NUA quando a regra a alcança sem nenhum contexto de
 * ancestral — ou seja, o seletor é um único compound formado por exatamente
 * essa classe (mais pseudo-classes/pseudo-elementos, que não mudam QUAL
 * elemento é alvo). São essas as declarações que colidem entre si por ordem
 * de carga: mesma especificidade, vence quem o bundle concatenar por último.
 *
 * NÃO são consideradas nuas — e não devem ser acusadas de colisão:
 *   `.withdraw-sheet .toast`  → escopado por ancestral, sobrescrita deliberada
 *   `.dash-body.shop-body`    → compound com outra classe, mais específico
 *   `div.card`                → qualificado por tipo
 * O escape hatch documentado para uma tela mexer numa classe do design
 * system é exatamente esse: escopar por um ancestral próprio da tela.
 *
 * A extração usa o parser do postcss (já presente na árvore, é o motor de CSS
 * do próprio Vite) em vez de regex de linha: seletores reais deste repositório
 * têm vírgula, `@media`, aninhamento com `&`, `:has()`, `:not()`,
 * `[data-theme]` e comentários no meio do seletor. Só o *seletor* é tokenizado
 * à mão, e o tokenizador respeita parênteses, colchetes e strings.
 */
import { readFileSync } from 'node:fs'
import postcss, { type Rule } from 'postcss'

export type BareClassDeclaration = {
  /** Nome da classe, sem o ponto. */
  className: string
  /** Caminho do arquivo que declara. */
  file: string
  /** Linha da regra no arquivo (1-based), quando o parser informa. */
  line: number
  /** O seletor exato, já resolvido de aninhamento — para a mensagem de erro. */
  selector: string
}

/** Quebra uma lista de seletores na vírgula de topo, ignorando vírgulas
 *  dentro de `(...)`, `[...]` ou string. */
export function splitSelectorList(selectorList: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let current = ''

  for (let i = 0; i < selectorList.length; i += 1) {
    const char = selectorList[i]

    if (quote) {
      current += char
      if (char === '\\') {
        current += selectorList[i + 1] ?? ''
        i += 1
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === '(' || char === '[') depth += 1
    if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)

  return parts.map((part) => part.trim()).filter((part) => part.length > 0)
}

/** Remove comentários de bloco de um seletor — postcss os preserva no
 *  `.selector`, e eles aparecem de fato no meio de listas neste repositório. */
function stripComments(selector: string): string {
  return selector.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/** Um seletor tem contexto de ancestral se contém combinador de topo
 *  (descendente, `>`, `+`, `~`) fora de parênteses/colchetes/strings. */
export function hasCombinator(selector: string): boolean {
  let depth = 0
  let quote: string | null = null

  for (let i = 0; i < selector.length; i += 1) {
    const char = selector[i]

    if (quote) {
      if (char === '\\') i += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(' || char === '[') depth += 1
    if (char === ')' || char === ']') depth -= 1
    if (depth > 0) continue
    if (char === '>' || char === '+' || char === '~') return true
    if (/\s/.test(char)) return true
  }

  return false
}

/** Se o seletor declara uma classe nua, devolve o nome dela; senão, null.
 *
 *  Nu = um único compound, exatamente uma classe, sem tipo/id/atributo.
 *  Pseudo-classes e pseudo-elementos são permitidos (`.card:hover`,
 *  `.card::before`): eles mudam o ESTADO alvo, não o elemento — a regra
 *  continua alcançando qualquer `.card` do documento. O conteúdo de pseudos
 *  funcionais (`:has(.x)`, `:not(.y)`) é argumento, não declaração, e por
 *  isso não conta como classe do compound. */
export function bareClassOf(rawSelector: string): string | null {
  const selector = stripComments(rawSelector).trim()
  if (!selector || hasCombinator(selector)) return null
  if (!selector.startsWith('.')) return null

  // Recorta o compound removendo o corpo dos pseudos funcionais, para que
  // `.a:has(.b)` seja lido como `.a:has()` e `.b` não vire "outra classe".
  let head = ''
  let depth = 0
  for (const char of selector) {
    if (char === '(') depth += 1
    if (depth === 0) head += char
    if (char === ')') depth -= 1
  }

  // Depois dos pseudos, o resto do compound não pode ter mais nada.
  const firstPseudo = head.search(/(?<!\\):/)
  const simplePart = firstPseudo === -1 ? head : head.slice(0, firstPseudo)
  if (!/^\.[A-Za-z_-][\w-]*$/.test(simplePart)) return null
  // Nada de `[attr]` ou `#id` pendurado depois dos pseudos.
  if (/[[#]/.test(head)) return null

  return simplePart.slice(1)
}

/** Resolve o seletor de uma regra aninhada (`&:hover` dentro de `.btn`). */
function resolveSelector(rule: Rule): string[] {
  const own = splitSelectorList(rule.selector)
  const parent = rule.parent
  if (parent && parent.type === 'rule') {
    const parents = resolveSelector(parent as Rule)
    return parents.flatMap((p) =>
      own.map((s) => (s.includes('&') ? s.replace(/&/g, p) : `${p} ${s}`)),
    )
  }
  return own
}

/** Todas as classes nuas declaradas num arquivo CSS. */
export function bareClassesInFile(file: string): BareClassDeclaration[] {
  const root = postcss.parse(readFileSync(file, 'utf8'), { from: file })
  const found: BareClassDeclaration[] = []

  root.walkRules((rule) => {
    // `@keyframes` usa `from`/`to`/`50%` como "seletor" — não é CSS de elemento.
    type Ancestor = { type: string; name?: string; parent?: Ancestor }
    let ancestor = rule.parent as Ancestor | undefined
    while (ancestor) {
      if (ancestor.type === 'atrule' && /keyframes$/i.test(ancestor.name ?? '')) return
      ancestor = ancestor.parent
    }

    for (const selector of resolveSelector(rule)) {
      const className = bareClassOf(selector)
      if (className) {
        found.push({
          className,
          file,
          line: rule.source?.start?.line ?? 0,
          selector: stripComments(selector).trim(),
        })
      }
    }
  })

  return found
}
