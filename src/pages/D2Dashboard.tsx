import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell/AppShell'
import { Card } from '../components/ui/Card/Card'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { isWithinCheckinWindow } from '../lib/agenda/checkinWindow'
import { dayWindow } from './Agenda/agendaShared'
import { getBookingsGrid, type Booking, type GetBookingsGridSuccess } from '../lib/api/bookings'
import { useMe } from '../hooks/useMe'
import { getActiveUnitId, getSessionMemberships } from '../lib/tenantContext'
import './DashboardPage.css'

/**
 * D2 — Dashboard Professor (BEAC-2095, story BEAC-2051). Agenda do dia
 * agregada de todas as arenas com membership (mesma estratégia cross-arena
 * de D1Dashboard/AG4TeacherAgendaPage), cada item rotulado com a arena de
 * origem. Check-ins pendentes = aulas de hoje dentro da janela de check-in
 * (`isWithinCheckinWindow`, extraída de AG4 para `checkinWindow.ts`) ainda
 * não marcadas. Tudo escopado ao próprio professor via `GET /me` — nunca
 * aceita um id vindo de props/URL. `unitId` do atalho "Meus Ganhos" vem de
 * `getActiveUnitId()` (mesmo padrão de auto-resolução de D3FDashboard) — a
 * rota de destino resolve o professor de novo via `GET /me`, então o unitId
 * do path é só cosmético (consistência de URL), não escopo de dado.
 */
export default function D2Dashboard() {
  const { orgLabel, userLabel } = useShellIdentity()
  const unitId = getActiveUnitId()
  // Compartilha o `GET /me` do useShellIdentity acima em vez de disparar um
  // segundo fetch só pelo id — ver hooks/useMe.ts.
  const { me } = useMe()
  const teacherId = me?.id ?? null
  const [bookings, setBookings] = useState<Booking[]>([])

  useEffect(() => {
    if (!teacherId) return
    let cancelled = false
    const memberships = getSessionMemberships()
    const { from, to } = dayWindow(new Date())
    Promise.all(
      memberships.map((m) => getBookingsGrid(m.unit_id, from, to, undefined, undefined, teacherId)),
    ).then((results) => {
      if (cancelled) return
      const merged = results
        .filter((r): r is GetBookingsGridSuccess => r.ok)
        .flatMap((r) => r.bookings)
        .filter((b) => b.status === 'confirmed' && b.type !== 'block' && b.type !== 'rental')
      setBookings(merged)
    })
    return () => {
      cancelled = true
    }
  }, [teacherId])

  const sortedBookings = useMemo(
    () => bookings.slice().sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [bookings],
  )

  const pendingCheckins = useMemo(() => {
    const now = new Date()
    return sortedBookings.filter((b) => !b.checkedIn && isWithinCheckinWindow(now, b.startAt))
  }, [sortedBookings])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <main className="dashboard-page">
        <h1>Dashboard</h1>

        <div className="dash-body">
          <section data-testid="dashboard-agenda">
            <Card>
              {sortedBookings.length === 0 ? <p className="hint">Nenhuma aula hoje.</p> : null}
              <ul>
                {sortedBookings.map((b) => (
                  <li key={b.id}>
                    <span>{b.className ?? 'Aula particular'}</span> · <span>{b.unitName}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section data-testid="dashboard-checkin-pending">
            <Card>
              <span className="stat-card__label">Check-ins pendentes</span>
              <span className="stat-card__value">{pendingCheckins.length}</span>
            </Card>
          </section>

          {unitId ? (
            <Link className="btn btn-primary" to={`/units/${unitId}/me/earnings`}>
              Meus Ganhos
            </Link>
          ) : null}
        </div>
      </main>
    </AppShell>
  )
}
