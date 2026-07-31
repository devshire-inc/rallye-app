import './StepIndicator.css'

export interface StepIndicatorProps {
  /** Total number of steps — 2 or 3 (Figma matrix is intentionally
   * incomplete: Total=2 has no Current=3). */
  total: 2 | 3
  /** Current step, 1-indexed. */
  current: number
  /**
   * Visible + accessible step text, e.g. "Passo 1 de 3". REQUIRED and never
   * derived from `total`/`current` automatically — see doc/STEP INDICATOR
   * (Figma node 320:1319): the component-set's Label property is shared
   * across all 5 Total×Current variants in Figma, so its default value
   * ("PASSO X DE Y") is only a generic placeholder, never real per-instance
   * text. The caller must always supply the real label explicitly.
   */
  label: string
}

/**
 * Progress indicator for the 2/3-step auth flows (Figma node 278:1773) —
 * not clickable navigation (that's Tabs).
 */
export function StepIndicator({ total, current, label }: StepIndicatorProps) {
  const steps = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <div className="step-indicator" role="group" aria-label={label}>
      <p className="step-indicator__label">{label}</p>
      <div className="step-indicator__track">
        {steps.map((step) => (
          <span
            key={step}
            className={
              step <= current
                ? 'step-indicator__segment step-indicator__segment--done'
                : 'step-indicator__segment step-indicator__segment--todo'
            }
          />
        ))}
      </div>
    </div>
  )
}
