const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/**
 * Converte AAAA-MM-DD em Date UTC ao meio-dia (evita pular de dia por fuso).
 * @param iso Data ISO.
 * @returns Date.
 */
export function isoToDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`)
}

/**
 * Data curta em português.
 * @param iso Data ISO.
 * @param withYear Inclui o ano.
 * @returns Ex.: "21 out 2026".
 */
export function formatDate(iso: string, withYear = true): string {
  const d = isoToDate(iso)
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  return withYear ? `${base} ${d.getUTCFullYear()}` : base
}

/**
 * Cabeçalho de dia para listas agrupadas.
 * @param iso Data ISO.
 * @returns Ex.: "quarta, 21 out 2026".
 */
export function formatDayHeading(iso: string): string {
  return `${WEEKDAYS[isoToDate(iso).getUTCDay()]}, ${formatDate(iso)}`
}

/**
 * Dias corridos entre duas datas ISO.
 * @param from Data inicial.
 * @param to Data final.
 * @returns Diferença em dias (pode ser negativa).
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoToDate(to).getTime() - isoToDate(from).getTime()) / 86400000)
}

/**
 * Soma dias a uma data ISO.
 * @param iso Data base.
 * @param days Quantidade de dias.
 * @returns Nova data ISO.
 */
export function addDays(iso: string, days: number): string {
  return new Date(isoToDate(iso).getTime() + days * 86400000).toISOString().slice(0, 10)
}

/**
 * Segunda-feira da semana da data.
 * @param iso Data ISO.
 * @returns Data ISO da segunda-feira.
 */
export function weekStart(iso: string): string {
  const d = isoToDate(iso)
  return addDays(iso, -((d.getUTCDay() + 6) % 7))
}

/**
 * Plural simples.
 * @param n Quantidade.
 * @param one Forma singular.
 * @param many Forma plural.
 * @returns Texto com número.
 */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`
}

/**
 * Mediana de uma lista de números.
 * @param values Valores.
 * @returns Mediana ou null para lista vazia.
 */
export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
