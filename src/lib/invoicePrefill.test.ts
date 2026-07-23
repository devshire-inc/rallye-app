import { describe, expect, it } from 'vitest'
import { prefillForType } from './invoicePrefill'

describe('prefillForType', () => {
  it('avulso: descrição e valor vazios', () => {
    expect(prefillForType('avulso', 'Julho/2026')).toEqual({ description: '', amount: null })
  })

  it('mensalidade: descrição usa o mês, valor fica em branco (gap: sem endpoint de plano)', () => {
    const result = prefillForType('mensalidade', 'Julho/2026')
    expect(result.description).toContain('Mensalidade Julho/2026')
    expect(result.amount).toBeNull()
  })

  it('pacote: descrição contém o prefixo esperado', () => {
    const result = prefillForType('pacote', 'Julho/2026')
    expect(result.description).toContain('Pacote')
    expect(result.amount).toBeNull()
  })

  it('torneio: descrição contém o prefixo esperado', () => {
    const result = prefillForType('torneio', 'Julho/2026')
    expect(result.description).toContain('Inscrição')
    expect(result.amount).toBeNull()
  })
})
