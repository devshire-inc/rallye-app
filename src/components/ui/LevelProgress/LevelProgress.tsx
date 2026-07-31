import { useId, type CSSProperties } from 'react'
import './LevelProgress.css'

export interface LevelProgressProps {
  /** Texto de critério visível, ex. "Faltam 3 vitórias para o nível C". */
  criterion: string
  /** 0–100. */
  percent: number
  currentLevel: string
  nextLevel: string
  className?: string
}

/**
 * Barra de progresso até o próximo nível (Figma node 196:33, "Progress=
 * Default"). Decorativa/informativa — não é `Skeleton` (não usar para
 * carregamento) e não recebe foco de teclado. Expõe `role="progressbar"`
 * real com `aria-valuenow`/`aria-valuemax` associado ao texto de critério
 * visível via `aria-labelledby`.
 */
export function LevelProgress({ criterion, percent, currentLevel, nextLevel, className }: LevelProgressProps) {
  const criterionId = useId()
  const clamped = Math.min(100, Math.max(0, percent))
  const style = { '--level-progress-percent': `${clamped}%` } as CSSProperties

  return (
    <div className={`level-progress${className ? ` ${className}` : ''}`}>
      <div className="level-progress__header">
        <span id={criterionId} className="level-progress__criterion">
          {criterion}
        </span>
        <span className="level-progress__percent">{Math.round(clamped)}%</span>
      </div>
      <div
        className="level-progress__track"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby={criterionId}
        style={style}
      >
        <div className="level-progress__fill" />
      </div>
      <div className="level-progress__footer">
        <span>Nível atual: {currentLevel}</span>
        <span>Próximo: {nextLevel}</span>
      </div>
    </div>
  )
}
