/**
 * Derivação das dimensões de variação da tela 23 (Detalhe do Produto).
 *
 * Mora fora de StoreProductPage.tsx porque são funções puras exportadas ao
 * lado de um componente — o que dispara `react-refresh/only-export-components`
 * (mesma separação já adotada entre ../../context/PermissionsContext.tsx e
 * ../../context/permissionsContextInstance.ts). Testá-las direto, sem montar
 * a tela, é o efeito colateral bem-vindo.
 *
 * O modelo: preço e estoque vivem na VARIAÇÃO. A tela oferece N dimensões
 * INDEPENDENTES (cor, peso), mas o que existe em estoque é a COMBINAÇÃO —
 * então nem todo par de escolhas resolve numa variação real, e isso é um
 * estado legítimo do modelo, não um erro.
 */
import type { StoreVariant } from '../../lib/api/store'

/** Uma dimensão de variação: a CHAVE de `variant.options` e os valores
 * distintos que aparecem nela. O frame 23 desenha duas (COR e PESO), mas nada
 * no contrato limita a duas. */
export interface Dimension {
  key: string
  label: string
  values: string[]
}

/**
 * Extrai as dimensões percorrendo as variações NA ORDEM em que o backend as
 * devolve (ele já ordena por `position`), o que faz a ordem das faixas e a
 * ordem dos chips dentro de cada faixa serem a ordem que a arena cadastrou —
 * não uma ordenação alfabética, que embaralharia "340g/360g".
 */
export function dimensionsOf(variants: StoreVariant[]): Dimension[] {
  const byKey = new Map<string, string[]>()
  for (const variant of variants) {
    for (const [key, value] of Object.entries(variant.options)) {
      const values = byKey.get(key)
      if (!values) {
        byKey.set(key, [value])
        continue
      }
      if (!values.includes(value)) values.push(value)
    }
  }
  return Array.from(byKey, ([key, values]) => ({ key, label: key.toUpperCase(), values }))
}

/** A variação que satisfaz TODAS as opções escolhidas — `null` quando a
 * combinação não existe (ex.: "Azul" só sai em 340g). */
export function matchVariant(
  variants: StoreVariant[],
  selection: Record<string, string>,
): StoreVariant | null {
  return (
    variants.find((variant) =>
      Object.entries(selection).every(([key, value]) => variant.options[key] === value),
    ) ?? null
  )
}

/**
 * Seleção inicial: as opções da primeira variação COM estoque; a primeira
 * variação quando nenhuma tem. Abrir a tela já com uma combinação esgotada
 * selecionada faria o botão nascer desabilitado sem o usuário ter escolhido
 * nada.
 */
export function initialSelection(variants: StoreVariant[]): Record<string, string> {
  const preferred = variants.find((variant) => variant.inStock) ?? variants[0]
  return preferred ? { ...preferred.options } : {}
}
