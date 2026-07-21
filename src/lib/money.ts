/** Formata um valor numérico como moeda brasileira ("R$ 3.500,00"). Sem
 * abreviação (o protótipo real usa "R$ 12,4k" em alguns lugares, mas isso é
 * um flourish visual do mockup, não um requisito de AC — valor completo é
 * mais previsível/testável). */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
