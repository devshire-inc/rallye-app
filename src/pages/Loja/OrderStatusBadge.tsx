import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import {
  STORE_ORDER_STATUS_GLYPH,
  STORE_ORDER_STATUS_LABEL,
  type StoreOrderStatus,
} from '../../lib/api/store'

/**
 * Tom por status, com as cores do frame 27 como referência: pronto para
 * retirada em verde (#dcf3e7/#17915b -> success), preparando em azul
 * (#e0eef4/#1b7192 -> info) e entregue em cinza (#edf2ed/#5d7186 -> neutral).
 *
 * Os dois status que o frame não desenha:
 * - `aguardando_pagamento` é **warning** porque pede ação do usuário — é o
 *   único estado em que existe um botão para ele apertar;
 * - `cancelado` é **danger**, e não o `neutral` que F5 dá a `cancelada`: aqui
 *   ele precisa se distinguir de `entregue`, que já ocupa o cinza, e um
 *   pedido cancelado depois de pago é justamente o que o usuário deve notar.
 */
const ORDER_STATUS_TONE: Record<StoreOrderStatus, NonNullable<BadgeProps['tone']>> = {
  aguardando_pagamento: 'warning',
  preparando: 'info',
  pronto: 'success',
  entregue: 'neutral',
  cancelado: 'danger',
}

/**
 * Status DERIVADO do pedido nas telas 26 e 27.
 *
 * `ui/EventStatusBadge` foi avaliado e descartado: o tipo `EventStatus` dele é
 * fechado no vocabulário de torneios (convite/inscrito/abertas/lotado/
 * encerrado) e nenhum dos cinco valores existe aqui — reusá-lo exigiria
 * ampliar um enum de outro domínio. `ui/Badge` cru, com o mapeamento de tom
 * acima, é o mesmo caminho que F5MyInvoicesPage já tomou.
 *
 * O emoji do frame vai num `aria-hidden`, fora do nome acessível: um leitor de
 * tela anunciaria "círculo verde grande" antes de "Pronto para retirada".
 */
export function OrderStatusBadge({ status }: { status: StoreOrderStatus }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]}>
      <span aria-hidden="true">{STORE_ORDER_STATUS_GLYPH[status]} </span>
      {STORE_ORDER_STATUS_LABEL[status]}
    </Badge>
  )
}
