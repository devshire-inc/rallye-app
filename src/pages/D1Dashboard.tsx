import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge/Badge'
import { Medal, type MedalTier } from '../components/ui/Medal/Medal'
import { TierChip, type TierChipTier } from '../components/ui/TierChip/TierChip'
import { LevelProgress } from '../components/ui/LevelProgress/LevelProgress'
import { StatCard } from '../components/ui/StatCard/StatCard'
import { SportTag } from '../components/ui/SportTag/SportTag'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { dayWindow } from './Agenda/agendaShared'
import { groupByArenaLabel } from '../lib/agenda/groupByArena'
import { getBookingsGrid, type Booking, type GetBookingsGridSuccess } from '../lib/api/bookings'
import { useMe } from '../hooks/useMe'
import { listSkillLevels, SKILL_TIERS, type SkillLevel, type SkillTier } from '../lib/api/skillLevels'
import { getActiveUnitId, getSessionMemberships } from '../lib/tenantContext'
import { fetchStudentXP, type StudentXP } from '../lib/api/xp'
import { sportCssVar, sportLabel } from '../lib/sports'
import './D1Dashboard.css'

/** medalha (StudentXP['medal'], PT-BR capitalizado) -> tier de `ui/Medal`
 * (lowercase, Figma node 196:32) — mesmos 5 degraus, só a casing muda. */
const MEDAL_TIER: Record<StudentXP['medal'], MedalTier> = {
  Bronze: 'bronze',
  Prata: 'prata',
  Ouro: 'ouro',
  Platina: 'platina',
  Diamante: 'diamante',
}

/** tier de skill-levels (SkillTier, snake_case) -> tier de `ui/TierChip`
 * (Figma node 195:30, kebab-case/maiúsculas). */
const TIER_CHIP_TIER: Record<SkillTier, TierChipTier> = {
  pe_na_areia: 'pe-na-areia',
  d: 'D',
  c: 'C',
  b: 'B',
  a: 'A',
  pro_open: 'pro-open',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function tierLabel(tier: string): string {
  return SKILL_TIERS.find((t) => t.value === tier)?.label ?? tier
}

/** Próximo degrau de SKILL_TIERS após `tier`, ou `null` no topo (Pro/Open). */
function nextTierLabel(tier: SkillTier): string | null {
  const index = SKILL_TIERS.findIndex((t) => t.value === tier)
  if (index === -1 || index === SKILL_TIERS.length - 1) return null
  return SKILL_TIERS[index + 1].label
}

/**
 * D1 — Dashboard Aluno (BEAC-2093, story BEAC-1736). Reskin (Figma node
 * 36:1067 mobile / 100:1237 desktop) sobre o design system: `StatCard` para
 * a Stats Grid, `TierChip`+`LevelProgress` para o Tier Card por esporte
 * (skill-levels reais, uma seção por linha de `listSkillLevels`) e `Medal`
 * para a medalha de engajamento (`fetchStudentXP`) — nenhum dos três tinha
 * consumidor real antes desta task. Medalha (Badge ad-hoc antigo) e nível
 * de habilidade (SportTag) seguem em seções distintas, nunca fundidos num
 * único indicador (AC central da story). Agenda do dia agregada de TODAS as
 * arenas em que o aluno tem membership, via `groupByArenaLabel` (extraída de
 * AG4TeacherAgendaPage.tsx). Tudo escopado ao próprio perfil via `GET /me` —
 * nunca aceita um id de aluno vindo de props/URL.
 *
 * Gaps de dado real (ver resumo do reskin em /tmp/dashboard-builder-summary.md):
 * a % de progresso do LevelProgress não existe no backend (skill-levels só
 * devolve o tier atual) — placeholder documentado, currentLevel/nextLevel
 * continuam reais. "Esporte principal" assume a primeira linha de
 * skill-levels (API não expõe um sport "principal"). "Loja" já não é mais um
 * gap: o atalho aponta para /units/{id}/store (telas 22/23/24), deixando de
 * ser renderizado desabilitado.
 *
 * Devolve só o MIOLO: a casca (`AppShell`) é montada uma única vez pelo
 * dispatcher `DashboardPage`, que a mantém viva do carregamento até a
 * variante resolvida — ver o comentário lá para o porquê. `useShellIdentity`
 * continua aqui só pelo `orgLabel` do eyebrow do cabeçalho (mesma entrada de
 * cache que a casca já lê, zero requisição extra).
 */
export default function D1Dashboard() {
  const { orgLabel } = useShellIdentity()
  // Mesma entrada de cache de `GET /me` que o `useShellIdentity` acima já
  // lê: antes esta tela disparava um SEGUNDO `GET /me` num useEffect só
  // para extrair o id (o hook de shell só expõe o `userLabel` combinado).
  const { me } = useMe()
  const studentId = me?.id ?? null
  const [xp, setXp] = useState<StudentXP | null>(null)
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  useEffect(() => {
    if (!studentId) return
    let cancelled = false

    fetchStudentXP(studentId).then((result) => {
      if (!cancelled && result.ok) setXp({ total_xp: result.total_xp, medal: result.medal })
    })

    listSkillLevels(studentId).then((result) => {
      if (!cancelled && result.ok) setSkillLevels(result.skillLevels)
    })

    const memberships = getSessionMemberships()
    const { from, to } = dayWindow(new Date())
    Promise.all(
      memberships.map((m) => getBookingsGrid(m.unit_id, from, to, undefined, studentId)),
    ).then((results) => {
      if (cancelled) return
      const merged = results
        .filter((r): r is GetBookingsGridSuccess => r.ok)
        .flatMap((r) => r.bookings)
        .filter((b) => b.status === 'confirmed')
      setBookings(merged)
    })

    return () => {
      cancelled = true
    }
  }, [studentId])

  const arenaGroups = useMemo(() => groupByArenaLabel(bookings), [bookings])
  const activeUnitId = getActiveUnitId()

  const subtitle =
    bookings.length === 0
      ? 'Nenhuma aula confirmada para hoje.'
      : bookings.length === 1
        ? 'Você tem 1 aula hoje.'
        : `Você tem ${bookings.length} aulas hoje.`

  const mainSport = skillLevels[0] ? sportLabel(skillLevels[0].sport) : '—'

  return (
    <main className="dashboard-page d1-dashboard">
      <header className="d1-dashboard__header">
        {orgLabel ? <p className="d1-dashboard__eyebrow">{orgLabel.toUpperCase()}</p> : null}
        <h1 className="d1-dashboard__title">Suas próximas aulas</h1>
        <p className="d1-dashboard__subtitle">{subtitle}</p>
      </header>

      <section className="d1-dashboard__stats" aria-label="Estatísticas do aluno">
        <StatCard label="Aulas hoje" value={String(bookings.length)} />
        <StatCard label="Esporte principal" value={mainSport} />
      </section>

      <section className="d1-dashboard__tiers" data-testid="dashboard-skill-levels">
        {skillLevels.map((sl) => {
          const next = nextTierLabel(sl.tier)
          return (
            <div className="tier-card" key={sl.sport}>
              <div className="tier-card__row-top">
                <span className="tier-card__eyebrow">SEU NÍVEL</span>
                <SportTag sport={sl.sport} />
              </div>
              <div className="tier-card__row-tier">
                <TierChip tier={TIER_CHIP_TIER[sl.tier]} sportCssVar={sportCssVar(sl.sport)} />
                <div className="tier-card__tier-text">
                  <span className="tier-card__tier-name">Nível {tierLabel(sl.tier)}</span>
                  <span className="tier-card__tier-detail">{sportLabel(sl.sport)}</span>
                </div>
              </div>
              {next ? (
                <LevelProgress
                  criterion="Continue evoluindo para o próximo nível"
                  percent={50}
                  currentLevel={tierLabel(sl.tier)}
                  nextLevel={next}
                />
              ) : (
                <p className="tier-card__max">Nível máximo já alcançado neste esporte.</p>
              )}
            </div>
          )
        })}
      </section>

      <section className="d1-dashboard__engagement" data-testid="dashboard-medal">
        {xp ? (
          <div className="engagement-card">
            <Medal tier={MEDAL_TIER[xp.medal]} size="md" />
            <div className="engagement-card__text">
              <span className="engagement-card__label">Engajamento</span>
              <span className="engagement-card__medal">{xp.medal}</span>
              <span className="engagement-card__xp">{xp.total_xp} XP</span>
            </div>
          </div>
        ) : null}
      </section>

      <nav className="d1-dashboard__quick-actions" aria-label="Atalhos">
        {activeUnitId ? (
          <Link className="quick-action" to={`/units/${activeUnitId}/agenda/minha`}>
            <span className="quick-action__icon">+</span>
            <span className="quick-action__label">Agendar</span>
          </Link>
        ) : null}
        {activeUnitId ? (
          <Link className="quick-action" to={`/units/${activeUnitId}/my-invoices`}>
            <span className="quick-action__icon">R$</span>
            <span className="quick-action__label">Faturas</span>
          </Link>
        ) : null}
        {activeUnitId ? (
          <Link className="quick-action" to={`/units/${activeUnitId}/tournaments`}>
            <span className="quick-action__icon">T</span>
            <span className="quick-action__label">Torneios</span>
          </Link>
        ) : null}
        {activeUnitId ? (
          <Link className="quick-action" to={`/units/${activeUnitId}/store`}>
            <span className="quick-action__icon">L</span>
            <span className="quick-action__label">Loja</span>
          </Link>
        ) : null}
      </nav>

      <section className="d1-dashboard__agenda" data-testid="dashboard-agenda">
        <div className="d1-dashboard__agenda-header">
          <h2 className="d1-dashboard__agenda-title">Próximas</h2>
          {activeUnitId ? (
            <Link className="d1-dashboard__agenda-link" to={`/units/${activeUnitId}/agenda/minha`}>
              Ver tudo →
            </Link>
          ) : null}
        </div>
        {arenaGroups.map((group) => (
          <div key={group.unitId} className="agenda-group">
            <h3 className="agenda-group__title">{group.unitName}</h3>
            <ul className="agenda-group__list">
              {group.items.map((booking) => (
                <li key={booking.id} className="agenda-row">
                  <span className="agenda-row__bar" aria-hidden="true" />
                  <div className="agenda-row__content">
                    <div className="agenda-row__title-line">
                      <span className="agenda-row__time">{formatTime(booking.startAt)}</span>
                      <span className="agenda-row__title">{booking.className ?? 'Aula particular'}</span>
                    </div>
                    {booking.teacherName ? (
                      <span className="agenda-row__meta">Prof. {booking.teacherName}</span>
                    ) : null}
                  </div>
                  <Badge tone="success">Confirmada</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  )
}
