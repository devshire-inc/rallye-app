import { z } from 'zod'
import { isValidBRPhone } from '../phone'

// Mensagens de validação inline da tela A2 (Cadastro de Conta). Mantidas
// idênticas às retornadas pelo backend (rallye-api/api/auth/handler.go) para
// os campos que ele também valida (telefone, senha), de forma que o feedback
// inline nunca diverja de um eventual erro 422 vindo da API.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Nome completo é obrigatório'),
    email: z
      .string()
      .trim()
      .min(1, 'E-mail é obrigatório')
      .refine((value) => EMAIL_PATTERN.test(value), 'E-mail em formato inválido'),
    phone: z
      .string()
      .min(1, 'Telefone é obrigatório')
      .refine(isValidBRPhone, 'Telefone em formato inválido — use (XX) XXXXX-XXXX'),
    password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type SignupFormValues = z.infer<typeof signupSchema>

export type SignupFieldErrors = Partial<Record<keyof SignupFormValues, string>>

/**
 * Roda o schema completo e devolve os erros por campo (vazio se tudo válido).
 * Usado tanto para validação inline (a cada mudança) quanto para o gate final
 * de habilitar o CTA "CRIAR MINHA CONTA".
 */
export function getSignupFieldErrors(values: SignupFormValues): SignupFieldErrors {
  const result = signupSchema.safeParse(values)
  if (result.success) return {}

  const errors: SignupFieldErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof SignupFormValues | undefined
    if (field && !errors[field]) {
      errors[field] = issue.message
    }
  }
  return errors
}
