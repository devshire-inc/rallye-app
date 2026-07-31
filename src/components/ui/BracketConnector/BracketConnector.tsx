import './BracketConnector.css'

export type BracketConnectorType = 'merge' | 'up' | 'down' | 'bye'

export interface BracketConnectorProps {
  type: BracketConnectorType
}

/** Conector puramente decorativo entre rodadas da chave (Figma node 265:1390) —
 * geometria fixa 40x108, sempre aria-hidden. */
export function BracketConnector({ type }: BracketConnectorProps) {
  return (
    <div className={`bracket-connector bracket-connector--${type}`} aria-hidden="true">
      {type === 'bye' ? (
        <span className="bracket-connector__line" />
      ) : (
        <>
          <span className="bracket-connector__stub bracket-connector__stub--top" />
          {type === 'merge' ? <span className="bracket-connector__stub bracket-connector__stub--bottom" /> : null}
          <span className="bracket-connector__joint" />
          <span className="bracket-connector__stub bracket-connector__stub--output" />
        </>
      )}
    </div>
  )
}
