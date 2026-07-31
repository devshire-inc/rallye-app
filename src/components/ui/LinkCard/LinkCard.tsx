import { useEffect, useState } from 'react'
import { Button } from '../Button/Button'
import './LinkCard.css'

export interface LinkCardProps {
  link?: string
  copyLabel?: string
  copiedLabel?: string
  /** Duração em ms que o rótulo "copiado" fica visível antes de voltar ao padrão. */
  copiedTimeout?: number
  onCopy?: (link: string) => void
}

export function LinkCard({
  link = '',
  copyLabel = 'Copiar',
  copiedLabel = 'Copiado!',
  copiedTimeout = 2000,
  onCopy,
}: LinkCardProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), copiedTimeout)
    return () => window.clearTimeout(timer)
  }, [copied, copiedTimeout])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      onCopy?.(link)
    } catch {
      // Clipboard indisponível (permissão negada, contexto não seguro) —
      // sem feedback de sucesso; o link continua visível/selecionável.
    }
  }

  return (
    <div className="link-card">
      <span className="link-card__link">{link}</span>
      <Button variant="soft" size="sm" onClick={handleCopy}>
        <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
      </Button>
    </div>
  )
}
