import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '../../components/AppShell/AppShell'
import { Toast } from '../../components/Toast'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Chip } from '../../components/ui/Chip/Chip'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { SportTag } from '../../components/ui/SportTag/SportTag'
import { useCartMutations } from '../../hooks/useCart'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { useToast } from '../../hooks/useToast'
import { BADGE_LABEL, type StoreProduct } from '../../lib/api/store'
import { formatBRL } from '../../lib/money'
import { storeFailureOf, storeProductQueryOptions } from '../../lib/query/store'
import { CartLink } from './CartLink'
import { dimensionsOf, initialSelection, matchVariant } from './variants'
import { STORE_CART_PATH, storeCatalogPath } from './routes'
import './Loja.css'

/**
 * 23 — Detalhe do Produto. Figma "23 · Loja — Detalhe do Produto — Aluno"
 * (node 177:5708 mobile / 189:2627 desktop).
 *
 * ## O que se adiciona ao carrinho é a VARIAÇÃO
 *
 * Preço e estoque vivem na variação, não no produto — "Shark Pro Preta 340g"
 * é o que existe na prateleira. A tela escolhe N dimensões independentes
 * (`dimensionsOf`), resolve o par escolhido numa variação (`matchVariant`) e
 * é o `variantId` dela que vai no POST. Três consequências visíveis:
 *
 * - o preço exibido é o da VARIAÇÃO selecionada (o backend já resolve o
 *   COALESCE variação/produto), caindo no preço de vitrine do produto só
 *   enquanto nenhuma combinação válida estiver escolhida;
 * - "Estoque: 8 unidades" é o da variação, nunca a soma do produto;
 * - uma combinação que não existe desabilita o botão com o motivo escrito,
 *   em vez de deixar o usuário descobrir no 404 do POST.
 *
 * Produto sem opções (todo produto tem ao menos uma variação, com
 * `options: {}`) simplesmente não rende faixa de chip nenhuma — a variação
 * única já está selecionada.
 *
 * ## Layout
 *
 * Mobile (177:5708) é coluna única; desktop (189:2627) é imagem 480px + uma
 * coluna de 552px ao lado. Um layout só no DOM, com o `grid` de duas colunas
 * abrindo em `BREAKPOINT_SHELL_DESKTOP_MIN` (ver Loja.css) — nada de tabela
 * e nada de `matchMedia`.
 *
 * ## Gaps conhecidos contra o frame (não fabricados)
 *
 * - **Bloco "Avaliações (23)" + "⭐ 4.7 (23 avaliações)" + "VER TODAS"**: não
 *   existe review no backend da Loja (nem tabela, nem endpoint, nem campo).
 *   O bloco inteiro foi omitido em vez de preenchido com depoimentos de
 *   exemplo — mesma postura de "gap conhecido, nunca escondido" já registrada
 *   em TournamentsListPage.
 * - **"📍 2,3 km"** ao lado do nome da arena: a distância exigiria geolocalização
 *   do usuário e coordenada da arena; `ProductResponse` devolve só o nome.
 *   A linha fica com o nome da arena, sem a distância.
 * - **Imagem do produto**: `imageUrl` é `null` em todo o seed atual, então o
 *   frame de 220px/480px cai no bloco `--surface-sunken` que o próprio Figma
 *   desenha (o frame também mostra a área vazia).
 */
export default function StoreProductPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, productId } = useParams<{ unitId: string; productId: string }>()

  const query = useQuery({
    ...storeProductQueryOptions(unitId ?? '', productId ?? ''),
    enabled: Boolean(unitId && productId),
  })

  const failure = storeFailureOf(query.error)

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head shop-head">
        {unitId ? (
          <Link className="back shop-back" to={storeCatalogPath(unitId)}>
            ‹ Loja
          </Link>
        ) : null}
        <div className="spacer" />
        <CartLink />
      </div>

      <div className="dash-body shop-body shop-body--detail">
        {query.isPending ? <PageLoading label="Carregando produto" variant="section" /> : null}

        {failure?.status === 404 ? (
          <p role="alert">Produto não encontrado.</p>
        ) : query.isError ? (
          <p role="alert">Não foi possível carregar o produto.</p>
        ) : null}

        {query.isSuccess ? <ProductDetail product={query.data} /> : null}
      </div>
    </AppShell>
  )
}

function ProductDetail({ product }: { product: StoreProduct }) {
  const navigate = useNavigate()
  const { add, pending } = useCartMutations()
  const toast = useToast()

  const dimensions = useMemo(() => dimensionsOf(product.variants), [product.variants])
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    initialSelection(product.variants),
  )

  const variant = matchVariant(product.variants, selection)
  // Sem combinação válida a tela ainda precisa mostrar UM preço — cai no de
  // vitrine do produto, que é o mesmo que o card do catálogo mostrava.
  const price = variant?.price ?? product.price
  const canAdd = variant !== null && variant.inStock && !pending

  async function handleAdd() {
    if (!variant) return
    const result = await add({ unitId: product.unitId, variantId: variant.id })
    if (result.ok) {
      toast.showSuccess('Adicionado ao carrinho')
      return
    }
    // `out_of_stock` é a única falha com uma leitura útil pro usuário: o
    // estoque acabou entre o carregamento da tela e o clique.
    toast.showError(
      result.error === 'out_of_stock'
        ? 'Este item acabou de esgotar.'
        : 'Não foi possível adicionar ao carrinho.',
    )
  }

  return (
    <div className="shop-detail">
      <div className="shop-detail__media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <span className="shop-detail__media-placeholder" aria-hidden="true" />
        )}
      </div>

      <div className="shop-detail__info">
        <p className="shop-detail__arena">{product.unitName}</p>
        <h1 className="shop-detail__name">{product.name}</h1>

        <div className="shop-detail__badges">
          {product.sport ? <SportTag sport={product.sport} /> : null}
          {product.badge ? <Badge tone="brand">{BADGE_LABEL[product.badge]}</Badge> : null}
        </div>

        <div className="shop-detail__prices">
          <span className="shop-detail__price">{formatBRL(price)}</span>
          {product.compareAtPrice !== null ? (
            <span className="shop-detail__old-price">{formatBRL(product.compareAtPrice)}</span>
          ) : null}
        </div>

        {/* `discountPercent` vem PRONTO do backend — o cliente nunca
            recalcula a conta que o servidor já fez. */}
        {product.discountPercent !== null ? (
          <span className="shop-detail__discount">🔥 {product.discountPercent}% off</span>
        ) : null}

        {dimensions.map((dimension) => (
          <div className="shop-detail__dimension" key={dimension.key}>
            <p className="shop-detail__dimension-label" id={`shop-dim-${dimension.key}`}>
              {dimension.label}
            </p>
            <div
              className="shop-chip-row"
              role="group"
              aria-labelledby={`shop-dim-${dimension.key}`}
            >
              {dimension.values.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  selected={selection[dimension.key] === value}
                  // Não desmarca ao reclicar (diferente dos filtros do
                  // catálogo): uma dimensão sem valor escolhido não resolve
                  // variação nenhuma, então "nenhum" não é um estado útil aqui.
                  onToggle={() =>
                    setSelection((current) => ({ ...current, [dimension.key]: value }))
                  }
                />
              ))}
            </div>
          </div>
        ))}

        <p className="shop-detail__stock">
          {variant === null
            ? 'Combinação indisponível'
            : variant.inStock
              ? `Estoque: ${variant.stockQuantity} ${variant.stockQuantity === 1 ? 'unidade' : 'unidades'}`
              : 'Esgotado'}
        </p>

        <Button variant="primary" size="lg" fullWidth disabled={!canAdd} onClick={handleAdd}>
          ADICIONAR AO CARRINHO
        </Button>

        {product.description ? (
          <div className="shop-detail__description">
            <h2>Descrição</h2>
            <p>{product.description}</p>
          </div>
        ) : null}
      </div>

      <Toast
        message={toast.message}
        tone={toast.variant === 'success' ? 'success' : 'danger'}
        onDismiss={toast.dismiss}
        action={
          toast.variant === 'success'
            ? { label: 'Ver carrinho', onClick: () => navigate(STORE_CART_PATH) }
            : undefined
        }
      />
    </div>
  )
}
