import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Chip } from '../../components/ui/Chip/Chip'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Input } from '../../components/ui/Input/Input'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { ProductCard } from '../../components/ui/ProductCard/ProductCard'
import {
  BADGE_LABEL,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type StoreCategory,
  type StoreProduct,
  type StoreSport,
} from '../../lib/api/store'
import { formatBRL } from '../../lib/money'
import { storeCatalogQueryOptions, storeFailureOf } from '../../lib/query/store'
import { SPORTS, sportCssVar } from '../../lib/sports'
import { CartLink } from './CartLink'
import { storeProductPath, STORE_ORDERS_PATH } from './routes'
import './Loja.css'

/** Os cinco esportes que o backend aceita em `?sport=`. `outro` existe no
 * catálogo de esportes do app (../../lib/sports.ts) mas NÃO no enum do
 * backend, então filtrar por ele seria um filtro que o servidor ignora — a
 * faixa de chips mostra só os que de fato filtram. */
const SPORT_SLUGS: StoreSport[] = ['beach_tennis', 'padel', 'futevolei', 'volei', 'tenis']
const SPORT_CHIPS = SPORT_SLUGS.map((slug) => ({
  slug,
  label: SPORTS.find((sport) => sport.slug === slug)?.label ?? slug,
}))

/** A busca vai pro servidor (`?q=`, ILIKE em nome e descrição), então cada
 * tecla digitada seria uma requisição. 350ms é o intervalo em que o usuário
 * termina de digitar uma palavra sem a lista parecer travada. */
const SEARCH_DEBOUNCE_MS = 350

/**
 * 22 — Loja da Arena (catálogo). Figma "22 · Loja da Arena — Aluno"
 * (node 177:5611 mobile / 189:2608 desktop) e "22b · Loja — Vazio"
 * (node 187:6976).
 *
 * ## `ui/ProductCard` ENCAIXOU — sem uma linha de card local
 *
 * O componente foi construído do Figma para esta tela e nunca tinha tido
 * consumidor real. O frame mobile instancia literalmente "ProductCard
 * Instance — Raquete Shark Pro" (node 295:9947), e todas as suas props têm
 * origem no contrato: `name`, `price`/`oldPrice` (price/compareAtPrice),
 * `tag` (badge), `image` (imageUrl), `arenaName` (unitName), `onClick`.
 * Nenhuma foi forçada e nenhuma sobrou por inventar dado — a única prop sem
 * origem real é `reviewLabel`, e ela simplesmente não é passada (ver gaps).
 * Foi o quarto componente do DS avaliado nesta leva e o primeiro a encaixar
 * sem ressalva.
 *
 * ## Filtros — chips do DS, estado no servidor
 *
 * As duas faixas do frame (categoria e esporte) são `ui/Chip`, cada uma com
 * escolha única + "Todos" implícito: clicar no chip já selecionado o
 * desmarca, que é o mesmo que "Todos". O chip "Todos" do frame é, portanto,
 * o estado "nenhuma categoria selecionada" — ele é renderizado, mas não é um
 * valor do enum do backend.
 *
 * Os filtros entram na CHAVE da query (../../lib/query/store.ts), não num
 * filtro local: `q` é ILIKE em nome E descrição no servidor, e a descrição
 * nem chega na listagem (vem vazia de propósito) — filtrar no cliente daria
 * um resultado diferente do que o backend promete.
 *
 * ## Desktop: grid de cards, NÃO tabela
 *
 * O frame desktop (189:2608) põe quatro cards numa linha — não uma `<table>`.
 * Então esta tela não adota o padrão `TableRow`/`TableHeaderCell` de F5
 * (Minhas Faturas); segue o de `TournamentsListPage`, com um layout único no
 * DOM e o grid abrindo em `BREAKPOINT_SHELL_DESKTOP_MIN`.
 *
 * ## Gaps conhecidos contra o frame (não fabricados)
 *
 * - **Avaliações** ("⭐ 4.7 (23)" em todo card): não existe tabela, endpoint
 *   nem campo de review no backend da Loja. `ProductCard.reviewLabel` fica
 *   sem valor em vez de receber um número inventado — mesma postura já
 *   registrada em TournamentsListPage para "6 categorias · 48 duplas".
 * - **"VER MARKETPLACE →"**: aponta para uma tela de marketplace multi-arena
 *   que não existe no protótipo nem no backend (o catálogo é sempre de UMA
 *   arena, por rota). Um link para lugar nenhum é pior que a ausência dele.
 * - **Filtro por esporte `outro`**: ver `SPORT_CHIPS` acima.
 */
export default function StoreCatalogPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()

  const [category, setCategory] = useState<StoreCategory | null>(null)
  const [sport, setSport] = useState<StoreSport | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filters = useMemo(() => ({ category, sport, q: search }), [category, sport, search])

  const query = useQuery({
    ...storeCatalogQueryOptions(unitId ?? '', filters),
    enabled: Boolean(unitId),
  })

  const failure = storeFailureOf(query.error)
  const products = query.data?.products ?? []
  const hasFilters = category !== null || sport !== null || search.trim() !== ''

  return (
    <>
      <div className="pg-head shop-head">
        <h1>Loja</h1>
        <div className="spacer" />
        {/* Entrada para a tela 27. O frame 22 não a desenha (o protótipo não
            liga 27 a nenhuma tela), mas "Meus Pedidos" precisa de um caminho
            que não seja fechar um pedido novo — e o item "Loja" da nav aparece
            ativo no frame 27 desktop, ou seja, ela vive dentro desta seção. */}
        <Link className="shop-head-link" to={STORE_ORDERS_PATH}>
          Meus pedidos
        </Link>
        <CartLink />
      </div>

      {/* `shop-body` e não o utilitário global `.dash-body--wide`: aquele é
          gatilhado por `:has(table)` e esta tela não tem tabela nenhuma — o
          gatilho equivalente aqui é o grid de cards (ver Loja.css). */}
      <div className="dash-body shop-body">
        <div className="shop-filters">
          <Input
            ariaLabel="Buscar produto"
            type="search"
            placeholder="🔍 Buscar produto..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <div className="shop-chip-row" role="group" aria-label="Filtrar por categoria">
            {/* "Todos" é a ausência de filtro, não um valor do enum — por
                isso ele não alterna nada, só zera a seleção. */}
            <Chip label="Todos" selected={category === null} onToggle={() => setCategory(null)} />
            {CATEGORY_ORDER.map((value) => (
              <Chip
                key={value}
                label={CATEGORY_LABEL[value]}
                selected={category === value}
                onToggle={(next) => setCategory(next ? value : null)}
              />
            ))}
          </div>

          <div className="shop-chip-row" role="group" aria-label="Filtrar por esporte">
            {SPORT_CHIPS.map((item) => (
              <Chip
                key={item.slug}
                label={item.label}
                dot
                dotColor={`var(${sportCssVar(item.slug)})`}
                selected={sport === item.slug}
                onToggle={(next) => setSport(next ? item.slug : null)}
              />
            ))}
          </div>
        </div>

        {query.isPending ? <PageLoading label="Carregando produtos" variant="section" /> : null}

        {failure?.status === 404 ? (
          <p role="alert">Esta arena não está disponível.</p>
        ) : query.isError ? (
          <p role="alert">Não foi possível carregar a loja.</p>
        ) : null}

        {query.isSuccess ? (
          products.length === 0 ? (
            <div className="shop-empty">
              <EmptyState
                icon={<span className="shop-empty__glyph">🛍</span>}
                title={hasFilters ? 'Nenhum produto encontrado' : 'Loja vazia por enquanto'}
                description={
                  hasFilters
                    ? 'Tente outra busca ou remova os filtros.'
                    : `Ainda não há produtos cadastrados${query.data.unitName ? ` em ${query.data.unitName}` : ' nesta arena'}.`
                }
              />
            </div>
          ) : (
            <div className="shop-grid">
              {products.map((product) => (
                <CatalogCard
                  key={product.id}
                  product={product}
                  onOpen={() => navigate(storeProductPath(product.unitId, product.id))}
                />
              ))}
            </div>
          )
        ) : null}
      </div>
    </>
  )
}

function CatalogCard({ product, onOpen }: { product: StoreProduct; onOpen: () => void }) {
  return (
    <ProductCard
      name={product.name}
      price={formatBRL(product.price)}
      oldPrice={product.compareAtPrice === null ? undefined : formatBRL(product.compareAtPrice)}
      tag={product.badge ? BADGE_LABEL[product.badge] : undefined}
      image={product.imageUrl ?? undefined}
      arenaName={product.unitName}
      onClick={onOpen}
    />
  )
}
