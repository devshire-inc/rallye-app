import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as blockRequestsApi from '../../lib/api/blockRequests'
import { TeacherBlockRequestButton, type TeacherAgendaClass } from './TeacherBlockRequestButton'

afterEach(() => {
  vi.restoreAllMocks()
})

const btIniciante: TeacherAgendaClass = {
  id: 'class-1',
  name: 'BT iniciante',
  daysLabel: 'seg/qua/sex',
  time: '07:00',
  court: 'Quadra 1',
  studentCount: 8,
  weekdays: [1, 3, 5], // seg, qua, sex
}

const padelAvancado: TeacherAgendaClass = {
  id: 'class-2',
  name: 'Padel avançado',
  daysLabel: 'ter/qui',
  time: '19:00',
  court: 'Quadra 2',
  studentCount: 4,
  weekdays: [2, 4], // ter, qui
}

function renderButton(classes: TeacherAgendaClass[] = [btIniciante, padelAvancado]) {
  render(<TeacherBlockRequestButton teacherId="teacher-1" classes={classes} />)
}

async function openSheet() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /solicitar bloqueio/i }))
  return user
}

async function fillPeriod(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  const dateInputs = screen.getAllByLabelText(/^(de|até)$/i)
  await user.clear(dateInputs[0])
  await user.type(dateInputs[0], from)
  await user.clear(dateInputs[1])
  await user.type(dateInputs[1], to)
}

describe('TeacherBlockRequestButton', () => {
  it('renders the trigger button, closed by default', () => {
    renderButton()
    expect(screen.getByRole('button', { name: /solicitar bloqueio/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the sheet with the exact title/subtitle copy', async () => {
    renderButton()
    await openSheet()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Solicitar indisponibilidade' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Vira um pedido pendente — o admin aprova cancelando a aula ou escalando um substituto.',
      ),
    ).toBeInTheDocument()
  })

  it('never renders a "sugerir substituto" toggle or a person-picker (confirmado ausente no protótipo real)', async () => {
    renderButton()
    await openSheet()

    expect(screen.queryByText(/sugerir substituto/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('always shows the disclaimer line below the submit button', async () => {
    renderButton()
    await openSheet()

    expect(
      screen.getByText(
        /O admin decide: cancelar a aula \(alunos recebem crédito\) ou escalar um professor substituto só para essa data — nunca reatribui a turma de forma permanente\./,
      ),
    ).toBeInTheDocument()
  })

  it('rejects an empty Motivo with a red-bordered field and the exact inline error message', async () => {
    renderButton()
    const user = await openSheet()

    await fillPeriod(user, '2026-07-20T10:00', '2026-07-22T10:00')
    await user.click(screen.getByRole('button', { name: /enviar solicitação/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Conte o motivo pra o admin decidir.')
    expect(screen.getByLabelText('Motivo').closest('.field')).toHaveClass('error')
  })

  it('does not call the API when Motivo is empty', async () => {
    const createSpy = vi.spyOn(blockRequestsApi, 'createTeacherBlockRequest')
    renderButton()
    const user = await openSheet()

    await fillPeriod(user, '2026-07-20T10:00', '2026-07-22T10:00')
    await user.click(screen.getByRole('button', { name: /enviar solicitação/i }))
    await screen.findByRole('alert')

    expect(createSpy).not.toHaveBeenCalled()
  })

  it('shows the affected-classes info box computed from the loaded agenda data', async () => {
    renderButton()
    const user = await openSheet()

    // 2026-07-20 (seg) a 2026-07-20 (mesmo dia) bate só com btIniciante.
    await fillPeriod(user, '2026-07-20T00:00', '2026-07-20T23:59')

    expect(screen.getByText(/isso afeta:/i)).toBeInTheDocument()
    expect(
      screen.getByText('BT iniciante · seg/qua/sex 07:00 · Quadra 1 · 8 alunos.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/padel avançado/i)).not.toBeInTheDocument()
  })

  it('does not show the affected-classes info box before a valid period is chosen', async () => {
    renderButton()
    await openSheet()

    expect(screen.queryByText(/isso afeta:/i)).not.toBeInTheDocument()
  })

  it('submits successfully and shows the inline green success panel, keeping the sheet open', async () => {
    vi.spyOn(blockRequestsApi, 'createTeacherBlockRequest').mockResolvedValue({
      ok: true,
      id: 'req-1',
      status: 'pending',
      createdAt: '2026-07-18T12:00:00Z',
    })
    renderButton()
    const user = await openSheet()

    await fillPeriod(user, '2026-07-20T10:00', '2026-07-22T10:00')
    await user.type(screen.getByLabelText('Motivo'), 'Consulta médica')
    await user.click(screen.getByRole('button', { name: /enviar solicitação/i }))

    const success = await screen.findByRole('status', {
      name: /solicitação enviada/i,
    })
    expect(success).toHaveTextContent(
      'Solicitação enviada! Entrou na Central de Pendências do admin.',
    )

    // Sheet stays open (not a toast/overlay, not auto-closed).
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    expect(blockRequestsApi.createTeacherBlockRequest).toHaveBeenCalledWith('teacher-1', {
      startDate: new Date('2026-07-20T10:00').toISOString(),
      endDate: new Date('2026-07-22T10:00').toISOString(),
      reason: 'Consulta médica',
    })
  })

  it('shows a generic error and keeps the form usable when the API call fails', async () => {
    vi.spyOn(blockRequestsApi, 'createTeacherBlockRequest').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'create_block_request_failed',
    })
    renderButton()
    const user = await openSheet()

    await fillPeriod(user, '2026-07-20T10:00', '2026-07-22T10:00')
    await user.type(screen.getByLabelText('Motivo'), 'Consulta médica')
    await user.click(screen.getByRole('button', { name: /enviar solicitação/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /solicitação enviada/i })).not.toBeInTheDocument()
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolveCreate: (value: blockRequestsApi.CreateTeacherBlockRequestResult) => void = () => {}
    vi.spyOn(blockRequestsApi, 'createTeacherBlockRequest').mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve
      }),
    )
    renderButton()
    const user = await openSheet()

    await fillPeriod(user, '2026-07-20T10:00', '2026-07-22T10:00')
    await user.type(screen.getByLabelText('Motivo'), 'Consulta médica')
    const submitButton = screen.getByRole('button', { name: /enviar solicitação/i })
    await user.click(submitButton)

    expect(submitButton).toBeDisabled()
    resolveCreate({ ok: true, id: 'req-2', status: 'pending', createdAt: '2026-07-18T12:00:00Z' })
  })
})
