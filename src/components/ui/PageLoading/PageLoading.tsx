import { Skeleton, SkeletonGroup } from '../Skeleton/Skeleton'
import './PageLoading.css'

export type PageLoadingVariant = 'page' | 'section' | 'list' | 'field'

export interface PageLoadingProps {
  /**
   * Anunciado uma única vez na região aria-live do <SkeletonGroup>, ex.
   * "Carregando horários". Substitui o antigo <p role="status">Carregando…</p>.
   */
  label: string
  /**
   * `page` (padrão) — pilha completa do Figma: título + filtro + destaque +
   * grade. Para quando o skeleton ocupa o corpo inteiro da tela.
   * `section` — sem o bloco de título, para quando o header real da página já
   * está visível e só o miolo carrega.
   * `list` — N <Skeleton type="tableRow"> em largura cheia, para os corpos de
   * página que carregam uma lista/tabela (a forma do conteúdo é conhecida).
   * `field` — um único bloco com a altura de um controle de formulário, para
   * quando o que carrega é um campo (um Select de quadras, por exemplo) e não
   * o corpo da página.
   */
  variant?: PageLoadingVariant
  /**
   * `page`/`section`: linhas da grade de 2 blocos (Figma mostra 2).
   * `list`: quantidade de linhas da lista (a doc do Figma sugere 5 para uma
   * tabela — aqui o padrão é 4, o que cabe sem rolagem no mobile).
   */
  rows?: number
  className?: string
}

/**
 * Estado de carregamento de página (Figma node 187:7216, "06b · Agendar —
 * Escolher Horário — Loading"). O design não usa o texto "Carregando": usa
 * blocos com a forma do conteúdo, dentro do layout normal da tela — o chrome
 * (header, bottom nav) continua visível.
 *
 * Decorativo por dentro (todos os blocos são aria-hidden); quem anuncia o
 * carregamento é o <SkeletonGroup>, uma vez só, via `label`.
 *
 * Quando a forma do conteúdo for óbvia (uma lista, um feed de cards), prefira
 * <Skeleton type="tableRow" /> / type="card" repetidos dentro de um
 * <SkeletonGroup> — este componente é o genérico, para quando não for.
 */
export function PageLoading({
  label,
  variant = 'page',
  rows = variant === 'list' ? 4 : 2,
  className,
}: PageLoadingProps) {
  const rootClassName = ['page-loading', `page-loading--${variant}`, className]
    .filter(Boolean)
    .join(' ')

  if (variant === 'field') {
    return (
      <SkeletonGroup label={label}>
        <div className={rootClassName} aria-hidden="true">
          <span className="skeleton__shape page-loading__filter" />
        </div>
      </SkeletonGroup>
    )
  }

  if (variant === 'list') {
    return (
      <SkeletonGroup label={label}>
        <div className={rootClassName}>
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} type="tableRow" />
          ))}
        </div>
      </SkeletonGroup>
    )
  }

  return (
    <SkeletonGroup label={label}>
      <div className={rootClassName} aria-hidden="true">
        {variant === 'page' && (
          <span className="skeleton__shape page-loading__title" />
        )}
        <span className="skeleton__shape page-loading__filter" />
        <span className="skeleton__shape page-loading__banner" />
        {Array.from({ length: rows }, (_, index) => (
          <div className="page-loading__row" key={index}>
            <span className="skeleton__shape page-loading__tile" />
            <span className="skeleton__shape page-loading__tile" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  )
}
