/**
 * Leitura e mutação do carrinho da Loja (`/me/store/cart`), sobre a query
 * compartilhada em ../lib/query/store.ts.
 *
 * Dois hooks, de propósito:
 *
 * - `useCartItemCount()` é o contador "🛒 (3)" que as TRÊS telas da Loja
 *   desenham no cabeçalho. Best-effort, no mesmo contrato de
 *   `useUnreadNotificationCount`: enquanto carrega e em qualquer falha
 *   devolve `0` e o contador só não aparece — um carrinho que não carregou
 *   nunca deve travar o catálogo.
 * - `useCartMutations()` é o trio add/quantidade/remover das telas 23 e 24.
 *   Cada mutação semeia o cache com o carrinho que a própria resposta traz
 *   (`applyCartResult`), então o contador acima se atualiza sem refetch.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCartItem,
  removeCartItem,
  updateCartItemQuantity,
  type CartResult,
} from '../lib/api/store'
import { applyCartResult, cartQueryOptions } from '../lib/query/store'

/** Quantidade de LINHAS do carrinho (não a soma das quantidades) — é o que o
 * frame escreve entre parênteses. `0` enquanto carrega e em qualquer falha. */
export function useCartItemCount(): number {
  const query = useQuery(cartQueryOptions())
  return query.data?.itemCount ?? 0
}

export interface CartMutations {
  add: (input: { unitId: string; variantId: string; quantity?: number }) => Promise<CartResult>
  setQuantity: (input: { itemId: string; quantity: number }) => Promise<CartResult>
  remove: (itemId: string) => Promise<CartResult>
  /** `true` enquanto QUALQUER das três está em voo. As telas usam isto para
   * travar os controles do carrinho inteiro durante uma mutação: as três
   * escrevem no mesmo recurso, e permitir um "−" enquanto um "remover" está
   * em voo produziria duas respostas concorrentes semeando o mesmo cache. */
  pending: boolean
}

export function useCartMutations(): CartMutations {
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: (input: { unitId: string; variantId: string; quantity?: number }) =>
      addCartItem(input.unitId, input.variantId, input.quantity),
    onSuccess: (result) => applyCartResult(queryClient, result),
  })

  const quantityMutation = useMutation({
    mutationFn: (input: { itemId: string; quantity: number }) =>
      updateCartItemQuantity(input.itemId, input.quantity),
    onSuccess: (result) => applyCartResult(queryClient, result),
  })

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: (result) => applyCartResult(queryClient, result),
  })

  return {
    add: (input) => addMutation.mutateAsync(input),
    setQuantity: (input) => quantityMutation.mutateAsync(input),
    remove: (itemId) => removeMutation.mutateAsync(itemId),
    pending: addMutation.isPending || quantityMutation.isPending || removeMutation.isPending,
  }
}
