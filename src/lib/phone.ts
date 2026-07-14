// Utilitários de telefone BR compartilhados pelas telas de auth (cadastro A2 e
// futuras telas que peçam telefone). Espelha a validação feita no backend
// (rallye-api/api/auth/phone.go) para dar feedback inline sem round-trip.

/** Celular BR: 2 dígitos de DDD (1-9 no primeiro) + 9 (prefixo de celular) + 8 dígitos. */
const LOCAL_PHONE_PATTERN = /^[1-9][0-9]9[0-9]{8}$/

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Aplica a máscara `(XX) XXXXX-XXXX` progressivamente enquanto o usuário
 * digita, aceitando colar números com ou sem formatação/DDI.
 */
export function formatBRPhoneInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

/** Valida um telefone (mascarado ou não) como celular BR válido. */
export function isValidBRPhone(value: string): boolean {
  return LOCAL_PHONE_PATTERN.test(onlyDigits(value))
}

/**
 * Converte um telefone BR válido para E.164 (`+55DDDNNNNNNNNN`), formato de
 * armazenamento (decisão travada). Retorna null se o telefone for inválido.
 */
export function toE164BRPhone(value: string): string | null {
  const digits = onlyDigits(value)
  if (!LOCAL_PHONE_PATTERN.test(digits)) return null
  return `+55${digits}`
}
