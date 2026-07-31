import './Pagination.css'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Quantos números de página vizinhos à página ativa mostrar de cada lado
   * antes de truncar — o símbolo do Figma (202:370) mostra 3 números fixos
   * porque a amostra tem poucas páginas; aqui escala para totalPages maior. */
  siblingCount?: number
}

function pageNumbers(page: number, totalPages: number, siblingCount: number): number[] {
  const start = Math.max(1, page - siblingCount)
  const end = Math.min(totalPages, page + siblingCount)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)
  return pages
}

export function Pagination({ page, totalPages, onPageChange, siblingCount = 1 }: PaginationProps) {
  const canPrev = page > 1
  const canNext = page < totalPages
  const pages = pageNumbers(page, totalPages, siblingCount)

  return (
    <nav className="pagination" aria-label="Paginação">
      <p className="pagination__count" aria-live="polite">
        Página {page} de {totalPages}
      </p>
      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__nav"
          aria-label="Página anterior"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`pagination__page${p === page ? ' pagination__page--active' : ''}`}
            aria-label={`Página ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="pagination__nav"
          aria-label="Próxima página"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </nav>
  )
}
