import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEarnings, type Earnings } from '../../lib/api/earnings'
import { ensureMe } from '../../lib/query/identity'
import { getTeacher } from '../../lib/api/teachers'
import { EarningsSummary } from './EarningsSummary'
import '../../components/AuthLayout/AuthLayout.css'
import '../Students/NewStudentPage.css'
import './TeacherProfilePage.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './TeacherEarningsPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; earnings: Earnings; remunerationValue: number }

/**
 * Self-view de "Meus Ganhos" (BEAC-2095, story BEAC-2051) — atalho do
 * D2Dashboard para o próprio professor logado. Mesma fonte de dados e
 * apresentação de TeacherEarningsPage.tsx (PR4, visão Admin de outro
 * professor) via o componente compartilhado `EarningsSummary` — decisão
 * travada do Épico 5: "os valores batem exatamente com a aba Comissão de
 * PR2". Escopado ao PRÓPRIO id via `GET /me` — nunca aceita um id de
 * professor vindo de props/URL (o `:unitId` da rota é só cosmético, ver
 * D2Dashboard.tsx). `GetHandler` de `/teachers/{id}/earnings` já faz bypass
 * de self no backend, então nenhum gate de permissão é necessário aqui
 * (mesma decisão de TeacherEarningsPage).
 */
export default function MyEarningsPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const queryClient = useQueryClient()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    // `ensureMe` no lugar de `getMe()`: mesmo contrato de retorno
    // (GetMeResult, nunca lança), mas lendo o GET /me que o
    // `useShellIdentity` acima já buscou em vez de disparar um segundo.
    ensureMe(queryClient).then((meResult) => {
      if (cancelled) return
      if (!meResult.ok) {
        setState({ status: 'error' })
        return
      }
      Promise.all([getEarnings(meResult.id), getTeacher(meResult.id)]).then(
        ([earningsResult, teacherResult]) => {
          if (cancelled) return
          if (!earningsResult.ok || !teacherResult.ok) {
            setState({ status: 'error' })
            return
          }
          setState({
            status: 'ready',
            earnings: earningsResult.earnings,
            remunerationValue: teacherResult.teacher.remunerationValue,
          })
        },
      )
    })
    return () => {
      cancelled = true
    }
  }, [queryClient])

  return (
    <>
      <div className="pg-head">
        <Link className="back" to={unitId ? `/units/${unitId}/dashboard` : '/dashboard'}>
          ‹ Dashboard
        </Link>
        <h1 style={{ fontSize: 18 }}>Meus ganhos</h1>
        <div className="spacer" />
      </div>

      {state.status === 'loading' ? <PageLoading label="Carregando ganhos" variant="section" /> : null}
      {state.status === 'error' ? <p role="alert">Não foi possível carregar seus ganhos.</p> : null}

      {state.status === 'ready' ? (
        <div className="dash-body">
          <EarningsSummary earnings={state.earnings} remunerationValue={state.remunerationValue} />
        </div>
      ) : null}
    </>
  )
}
