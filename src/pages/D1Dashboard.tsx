import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell/AppShell'
import { Badge, type BadgeProps } from '../components/ui/Badge/Badge'
import { Card } from '../components/ui/Card/Card'
import { SportTag } from '../components/ui/SportTag/SportTag'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { dayWindow } from './Agenda/agendaShared'
import { groupByArenaLabel } from '../lib/agenda/groupByArena'
import { getBookingsGrid, type Booking, type GetBookingsGridSuccess } from '../lib/api/bookings'
import { getMe } from '../lib/api/me'
import { listSkillLevels, SKILL_TIERS, type SkillLevel } from '../lib/api/skillLevels'
import { getSessionMemberships } from '../lib/tenantContext'
import { fetchStudentXP, type StudentXP } from '../lib/api/xp'
import './DashboardPage.css'

/** Mapeamento tone (Badge, ui/Badge) <- medalha, decisão desta implementação
 * (sem correspondência 1:1 travada em planejamento) — ordem crescente de
 * engajamento acompanha uma progressão visual crescente de destaque. */
const MEDAL_TONE: Record<StudentXP['medal'], NonNullable<BadgeProps['tone']>> = {
  Bronze: 'neutral',
  Prata: 'info',
  Ouro: 'warning',
  Platina: 'brand',
  Diamante: 'success',
}

function tierLabel(tier: string): string {
  return SKILL_TIERS.find((t) => t.value === tier)?.label ?? tier
}

/**
 * D1 — Dashboard Aluno (BEAC-2093, story BEAC-1736). Medalha de engajamento
 * (Badge) e nível de habilidade por esporte (SportTag) em Cards distintos —
 * nunca fundidos num único indicador (AC central da story). Agenda do dia
 * agregada de TODAS as arenas em que o aluno tem membership, via
 * `groupByArenaLabel` (extraída de AG4TeacherAgendaPage.tsx, mesma
 * estratégia de busca cross-arena). Tudo escopado ao próprio perfil via
 * `GET /me` — nunca aceita um id de aluno vindo de props/URL.
 */
export default function D1Dashboard() {
  const { orgLabel, userLabel } = useShellIdentity()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [xp, setXp] = useState<StudentXP | null>(null)
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  useEffect(() => {
    let cancelled = false
    getMe().then((result) => {
      if (cancelled || !result.ok) return
      setStudentId(result.id)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <main className="dashboard-page">
        <h1>Dashboard</h1>

        <section data-testid="dashboard-medal">
          <Card>{xp ? <Badge tone={MEDAL_TONE[xp.medal]}>{xp.medal}</Badge> : null}</Card>
        </section>

        <section data-testid="dashboard-skill-levels">
          <Card>
            {skillLevels.map((sl) => (
              <SportTag key={sl.sport} sport={sl.sport}>
                {tierLabel(sl.tier)}
              </SportTag>
            ))}
          </Card>
        </section>

        <section data-testid="dashboard-agenda">
          <Card>
            {arenaGroups.map((group) => (
              <div key={group.unitId}>
                <h2>{group.unitName}</h2>
                <ul>
                  {group.items.map((booking) => (
                    <li key={booking.id}>{booking.className ?? 'Aula particular'}</li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        </section>
      </main>
    </AppShell>
  )
}
