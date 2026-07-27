import { Card } from './Card/Card'
import { IconButton } from './IconButton/IconButton'

export const validIconButtonUsage = (
  <IconButton label="Fechar" onClick={() => {}}>
    ×
  </IconButton>
)
export const validCardNonInteractiveUsage = <Card>conteúdo não interativo</Card>
export const validCardInteractiveUsage = (
  <Card interactive onClick={() => {}}>
    conteúdo interativo
  </Card>
)
// @ts-expect-error — label é obrigatório em IconButtonProps
export const invalidIconButtonNoLabel = <IconButton onClick={() => {}}>×</IconButton>
// @ts-expect-error — modo interativo (interactive:true) exige onClick
export const invalidCardInteractiveNoOnClick = <Card interactive>conteúdo</Card>
// @ts-expect-error — onClick só é aceito junto com interactive:true
export const invalidCardOnClickNoInteractive = <Card onClick={() => {}}>conteúdo</Card>
