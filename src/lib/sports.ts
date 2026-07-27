/**
 * Catálogo de esportes oferecidos por uma unit (slug ⇄ rótulo em PT-BR ⇄ cor
 * do "dot" — ver `--sport-*` em src/styles/tokens/colors.css). Extraído de
 * `pages/Units/NewUnitPage.tsx` (BEAC-1832, onde esta lista nasceu como o
 * multi-select "Esportes oferecidos") para ser reaproveitado por S1
 * (BEAC-1835, `arena-sports`/`sporttag` do protótipo real) sem duplicar a
 * tabela slug→rótulo. `public.units.sports_offered` é um array JSON de slugs
 * em snake_case (`["beach_tennis","futevolei"]`, ver comentário da migration
 * 000005 e o handler.go de units) — não um schema fixo, então slugs fora
 * desta lista (dado futuro/manual) são exibidos com o próprio slug como
 * rótulo de fallback, nunca omitidos.
 */
export interface Sport {
  slug: string
  label: string
  /** Nome da custom property `--sport-*` (src/index.css) usada no dot. */
  cssVar: string
}

export const SPORTS: Sport[] = [
  { slug: 'beach_tennis', label: 'Beach tennis', cssVar: '--sport-beach-tennis' },
  { slug: 'padel', label: 'Padel', cssVar: '--sport-padel' },
  { slug: 'futevolei', label: 'Futevôlei', cssVar: '--sport-futevolei' },
  { slug: 'volei', label: 'Vôlei', cssVar: '--sport-volei' },
  { slug: 'tenis', label: 'Tênis', cssVar: '--sport-tenis' },
  { slug: 'outro', label: 'Outro', cssVar: '--sport-outro' },
]

const SPORTS_BY_SLUG = new Map(SPORTS.map((sport) => [sport.slug, sport]))

/** Rótulo em PT-BR para um slug conhecido; o próprio slug como fallback. */
export function sportLabel(slug: string): string {
  return SPORTS_BY_SLUG.get(slug)?.label ?? slug
}

/** Var CSS do dot colorido para um slug conhecido; cinza neutro
 * (`--border-default`) como fallback para slugs fora do catálogo conhecido. */
export function sportCssVar(slug: string): string {
  return SPORTS_BY_SLUG.get(slug)?.cssVar ?? '--border-default'
}
