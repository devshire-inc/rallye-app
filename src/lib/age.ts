// Cálculo de menoridade a partir de birth_date (BEAC-1859, story BEAC-1688):
// "QUANDO a data de nascimento indica menor de 18 anos, O SISTEMA DEVE
// exibir e exigir os campos de responsável legal". Espelha a MESMA regra do
// backend (api/internal/students/handler.go's isMinor, rallye-api) para dar
// feedback inline sem round-trip — o backend permanece a fonte de verdade
// (reforça a mesma regra na validação do POST).
export function isMinor(birthDateISO: string, now: Date = new Date()): boolean {
  const birthDate = new Date(birthDateISO + 'T00:00:00Z')
  if (Number.isNaN(birthDate.getTime())) return false

  const cutoff = new Date(birthDate)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() + 18)
  return now.getTime() < cutoff.getTime()
}
