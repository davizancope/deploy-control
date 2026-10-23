export type CellValue = string | number | Date | null | undefined

/** Data crua de uma célula: "date" veio tipada da planilha (pode estar com mês e dia trocados); "text" foi digitada como texto. */
export type RawDate =
  | { kind: 'date'; y: number; m: number; d: number }
  | { kind: 'text'; a: number; b: number; y: number | null }
  | { kind: 'iso'; y: number; m: number; d: number }

export type ResolvedDate = { iso: string; inferredYear: boolean; swapped: boolean }

export type ResolvedSheetDates = {
  dates: Array<ResolvedDate | null>
  swappedCount: number
  inferredYearCount: number
  outOfOrder: Set<number>
  usFormat: boolean
}

/**
 * Lê a célula de data sem decidir ainda se é dia/mês ou mês/dia.
 * @param value Valor da célula (texto, Date do Excel ou número serial).
 * @returns Data crua ou null se não parecer data.
 */
export function parseRawDate(value: CellValue): RawDate | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return { kind: 'date', y: value.getUTCFullYear(), m: value.getUTCMonth() + 1, d: value.getUTCDate() }
  }
  if (typeof value === 'number') {
    if (value < 20000 || value > 80000) return null
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    return { kind: 'date', y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
  }
  const text = value.trim()
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return { kind: 'iso', y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }
  const br = text.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/)
  if (!br) return null
  const y = br[3] ? (br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])) : null
  return { kind: 'text', a: Number(br[1]), b: Number(br[2]), y }
}

/**
 * Resolve as datas de uma aba inteira usando a ordem cronológica das linhas.
 * Testa duas hipóteses para as células tipadas (como estão, ou com mês e dia trocados, que é o que o Google Sheets
 * em inglês faz quando alguém digita dd/mm) e fica com a que deixa a sequência em ordem.
 * @param raws Datas cruas na ordem das linhas.
 * @param referenceDate Hoje; datas muito no futuro são tratadas como erro.
 * @returns Datas finais, quantas foram trocadas, quantas tiveram o ano completado e quais ficaram fora de ordem.
 */
export function resolveSheetDates(raws: Array<RawDate | null>, referenceDate: Date): ResolvedSheetDates {
  const asIs = resolveWith(raws, false, referenceDate)
  const swapped = resolveWith(raws, true, referenceDate)

  let useSwap = swapped.score < asIs.score
  if (swapped.score === asIs.score) useSwap = looksUsLocale(raws)
  const chosen = useSwap ? swapped : asIs

  return {
    dates: chosen.dates,
    swappedCount: chosen.dates.filter((d) => d?.swapped).length,
    inferredYearCount: chosen.dates.filter((d) => d?.inferredYear).length,
    outOfOrder: chosen.outOfOrder,
    usFormat: useSwap,
  }
}

// Todas as datas tipadas com "dia" até 12 é sinal forte de dd/mm digitado numa planilha em mm/dd.
function looksUsLocale(raws: Array<RawDate | null>): boolean {
  const typed = raws.filter((r): r is Extract<RawDate, { kind: 'date' }> => r?.kind === 'date')
  return typed.length >= 4 && typed.every((r) => r.d <= 12) && typed.some((r) => r.d !== r.m)
}

function resolveWith(raws: Array<RawDate | null>, swapTyped: boolean, referenceDate: Date) {
  const ref = utcDay(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, referenceDate.getUTCDate())
  const dates: Array<ResolvedDate | null> = []
  const outOfOrder = new Set<number>()
  let prev: number | null = null
  let score = 0

  raws.forEach((raw, i) => {
    const r = resolveOne(raw, swapTyped, prev, ref)
    dates.push(r ? { iso: r.iso, inferredYear: r.inferredYear, swapped: r.swapped } : null)
    if (!r) return
    if (r.day > ref + 2) score += 10000
    if (prev !== null && r.day < prev) {
      score += 1000 + (prev - r.day)
      outOfOrder.add(i)
    }
    prev = Math.max(prev ?? r.day, r.day)
  })

  return { dates, outOfOrder, score }
}

function resolveOne(raw: RawDate | null, swapTyped: boolean, prev: number | null, ref: number) {
  if (!raw) return null
  if (raw.kind === 'iso') return make(raw.y, raw.m, raw.d, false, false)
  if (raw.kind === 'date') {
    if (swapTyped && raw.d <= 12 && raw.d !== raw.m) return make(raw.y, raw.d, raw.m, false, true)
    return make(raw.y, raw.m, raw.d, false, false)
  }
  // Texto: dd/mm primeiro (padrão brasileiro); mm/dd só quando dd/mm é impossível.
  const orders: Array<[number, number, boolean]> = [
    [raw.b, raw.a, false],
    [raw.a, raw.b, true],
  ]
  for (const [m, d, swapped] of orders) {
    if (raw.y !== null) {
      const r = make(raw.y, m, d, false, swapped)
      if (r) return r
      continue
    }
    const base = prev !== null ? new Date(prev * 86400000).getUTCFullYear() : new Date(ref * 86400000).getUTCFullYear()
    const options = [base, base + 1, base - 1]
      .map((y) => make(y, m, d, true, swapped))
      .filter((r): r is NonNullable<typeof r> => r !== null && r.day <= ref + 31)
    if (!options.length) continue
    if (prev === null) return options.find((o) => o.day <= ref + 2) ?? options[0]
    const forward = options.filter((o) => o.day >= prev).sort((x, y) => x.day - y.day)
    return forward[0] ?? options.sort((x, y) => Math.abs(x.day - prev) - Math.abs(y.day - prev))[0]
  }
  return null
}

function make(y: number, m: number, d: number, inferredYear: boolean, swapped: boolean) {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return null
  const day = utcDay(y, m, d)
  const check = new Date(day * 86400000)
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null
  return { iso: `${y}-${pad(m)}-${pad(d)}`, day, inferredYear, swapped }
}

function utcDay(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Data de hoje em ISO, no fuso de São Paulo.
 * @returns AAAA-MM-DD.
 */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
