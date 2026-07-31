import { Icon } from '../Icon/Icon'
import './PasswordStrength.css'

export type PasswordStrengthLevel = 'none' | 'weak' | 'medium' | 'strong'

export interface Requirement {
  /** Requirement text, e.g. "Mínimo 8 caracteres". */
  label: string
  met: boolean
}

export interface PasswordStrengthProps {
  /** Strength level to render. This component is purely presentational —
   * computing the level (entropy/rules) from an actual password is the
   * caller's job, not this component's. */
  level: PasswordStrengthLevel
  /** Caption shown next to the level word, e.g. "Força da senha". */
  caption?: string
  /** Requirement checklist — defaults to the Rallye policy (Figma node
   * 278:1904): min 8 chars, 1 number, 1 uppercase letter. */
  requirements?: Requirement[]
}

const LEVEL_META: Record<PasswordStrengthLevel, { word: string; filledBars: number }> = {
  none: { word: '—', filledBars: 0 },
  weak: { word: 'Fraca', filledBars: 1 },
  medium: { word: 'Média', filledBars: 2 },
  strong: { word: 'Forte', filledBars: 4 },
}

/**
 * Password strength meter + requirement checklist (Figma node 278:1904).
 * Strength is never communicated by color alone — the level word and the
 * check/close icon per requirement carry the same information as text.
 */
export function PasswordStrength({
  level,
  caption = 'Força da senha',
  requirements = [
    { label: 'Mínimo 8 caracteres', met: level !== 'none' },
    { label: '1 número', met: level === 'medium' || level === 'strong' },
    { label: '1 letra maiúscula', met: level === 'strong' },
  ],
}: PasswordStrengthProps) {
  const { word, filledBars } = LEVEL_META[level]

  return (
    <div className="password-strength">
      <div className="password-strength__bars">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              i < filledBars
                ? `password-strength__bar password-strength__bar--${level}`
                : 'password-strength__bar'
            }
          />
        ))}
      </div>
      <div className="password-strength__row">
        <span className="password-strength__caption">{caption}</span>
        <span
          className={
            level === 'none'
              ? 'password-strength__level'
              : `password-strength__level password-strength__level--${level}`
          }
          aria-live="polite"
        >
          {word}
        </span>
      </div>
      <ul className="password-strength__requirements">
        {requirements.map((req) => (
          <li key={req.label} className="password-strength__requirement">
            <Icon
              name={req.met ? 'check' : 'close'}
              size={16}
              className={
                req.met
                  ? 'password-strength__requirement-icon password-strength__requirement-icon--met'
                  : 'password-strength__requirement-icon'
              }
            />
            <span
              className={
                req.met
                  ? 'password-strength__requirement-label password-strength__requirement-label--met'
                  : 'password-strength__requirement-label'
              }
            >
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
