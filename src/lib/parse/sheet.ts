import type { DeployType, Environment, LinkedCommit, LinkedPr } from '@/lib/types'
import { parseRawDate, resolveSheetDates, type CellValue, type RawDate } from './dates'
import { pairColumns } from './changes'
import { extractTokens } from './tokens'

export type SheetRow = CellValue[]

export type ParsedDeploy = {
  sourceRow: number
  code_version: string
  branch: string | null
  environment: Environment
  deployed_on: string
  sprint: string | null
  type: DeployType
  source_branch: string | null
  merged_branches: string[]
  notes: string | null
  tasks: string[]
  pull_requests: LinkedPr[]
  commits: LinkedCommit[]
  warnings: string[]
}

export type SkippedRow = { sourceRow: number; reason: string }

export type ParsedSheet = {
  sheetName: string
  deploys: ParsedDeploy[]
  skipped: SkippedRow[]
  inferredYearCount: number
  swappedDateCount: number
  unlinkedCount: number
  jiraBaseUrl: string | null
  repoUrl: string | null
  error: string | null
}

type ColumnKey =
  | 'code_version'
  | 'branch'
  | 'environment'
  | 'date'
  | 'sprint'
  | 'type'
  | 'source_branch'
  | 'merged'
  | 'tasks'
  | 'prs'

const HEADER_ALIASES: Array<[ColumnKey, (h: string) => boolean]> = [
  ['code_version', (h) => h === 'codeversion' || h === 'versao'],
  ['branch', (h) => h === 'branchbase' || h === 'branch'],
  ['environment', (h) => h === 'ambiente' || h === 'environment' || h === 'env'],
  ['date', (h) => h.startsWith('data') || h === 'date'],
  ['sprint', (h) => h === 'sprint'],
  ['type', (h) => h === 'tipo' || h === 'type'],
  ['source_branch', (h) => h.startsWith('criadaapartir') || h === 'origem' || h === 'source'],
  ['merged', (h) => h.startsWith('atualizadacom')],
  ['tasks', (h) => h.startsWith('task') || h.startsWith('tarefa') || h === 'jira'],
  ['prs', (h) => h === 'linkpr' || h === 'pr' || h === 'prs' || h.startsWith('pullrequest')],
]

/**
 * Remove acentos e tudo que não for letra/número, em minúsculas.
 * @param value Texto original.
 * @returns Texto normalizado para comparação.
 */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

/**
 * Normaliza o ambiente escrito à mão.
 * @param value Texto da coluna Ambiente.
 * @returns staging, production ou null se não reconhecer.
 */
export function parseEnvironment(value: string): Environment | null {
  const k = normalizeKey(value)
  if (['producao', 'production', 'prod', 'prd', 'live'].includes(k)) return 'production'
  if (['staging', 'stg', 'stage', 'homologacao', 'hml', 'qa'].includes(k)) return 'staging'
  return null
}

/**
 * Normaliza o tipo do deploy.
 * @param value Texto da coluna Tipo.
 * @returns release, hotfix, bugfix ou null se vazio/desconhecido.
 */
export function parseType(value: string): DeployType | null {
  const k = normalizeKey(value)
  if (k === 'release') return 'release'
  if (k === 'hotfix') return 'hotfix'
  if (k === 'bugfix' || k === 'fix' || k === 'bug') return 'bugfix'
  return null
}

function inferType(codeVersion: string, branch: string | null): DeployType {
  return /hotfix/i.test(`${codeVersion} ${branch ?? ''}`) ? 'hotfix' : 'release'
}

function findHeader(rows: SheetRow[]): { index: number; columns: Map<ColumnKey, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const keys = rows[i].map((c) => normalizeKey(cellText(c)))
    if (!keys.includes('codeversion')) continue
    const columns = new Map<ColumnKey, number>()
    keys.forEach((h, idx) => {
      if (!h) return
      const match = HEADER_ALIASES.find(([key, test]) => !columns.has(key) && test(h))
      if (match) columns.set(match[0], idx)
    })
    return { index: i, columns }
  }
  return null
}

/**
 * Lê uma aba da planilha de controle de versão e devolve deploys normalizados, com avisos por linha.
 * @param sheetName Nome da aba (vira o nome sugerido do projeto).
 * @param rows Linhas cruas da aba, incluindo o cabeçalho.
 * @param referenceDate Data usada para inferir o ano quando a célula só tem dia/mês.
 * @returns Deploys válidos, linhas ignoradas e metadados do projeto (Jira, repositório).
 */
export function parseSheet(sheetName: string, rows: SheetRow[], referenceDate = new Date()): ParsedSheet {
  const result: ParsedSheet = {
    sheetName: sheetName.trim(),
    deploys: [],
    skipped: [],
    inferredYearCount: 0,
    swappedDateCount: 0,
    unlinkedCount: 0,
    jiraBaseUrl: null,
    repoUrl: null,
    error: null,
  }

  const header = findHeader(rows)
  if (!header) {
    result.error = 'Não encontrei a coluna "Code Version" no cabeçalho desta aba.'
    return result
  }

  const { columns } = header
  const get = (row: SheetRow, key: ColumnKey): CellValue => {
    const idx = columns.get(key)
    return idx === undefined ? null : row[idx]
  }
  const text = (row: SheetRow, key: ColumnKey) => cellText(get(row, key))
  const knownIdx = new Set(columns.values())
  const rawDates: RawDate[] = []
  const jiraCounts = new Map<string, number>()
  const repoCounts = new Map<string, number>()
  const seen = new Map<string, number>()

  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i]
    const sourceRow = i + 1
    if (!row || row.every((c) => cellText(c) === '')) continue

    const codeVersion = text(row, 'code_version')
    if (!codeVersion) {
      result.skipped.push({ sourceRow, reason: 'Linha sem code version.' })
      continue
    }
    if (codeVersion.length > 120 || /\s/.test(codeVersion)) {
      result.skipped.push({ sourceRow, reason: `Code version "${codeVersion.slice(0, 40)}" inválido (espaços ou mais de 120 caracteres).` })
      continue
    }

    const environment = parseEnvironment(text(row, 'environment'))
    if (!environment) {
      const raw = text(row, 'environment')
      result.skipped.push({
        sourceRow,
        reason: raw ? `Ambiente "${raw}" não reconhecido.` : 'Linha sem ambiente.',
      })
      continue
    }

    const rawDate = parseRawDate(get(row, 'date'))
    if (!rawDate) {
      const raw = text(row, 'date')
      result.skipped.push({ sourceRow, reason: raw ? `Data "${raw}" inválida.` : 'Linha sem data.' })
      continue
    }

    const warnings: string[] = []
    const branch = text(row, 'branch') || null
    const rawType = text(row, 'type')
    let type = parseType(rawType)
    if (!type) {
      type = inferType(codeVersion, branch)
      warnings.push(rawType ? `Tipo "${rawType}" desconhecido; usei ${type}.` : `Sem tipo; usei ${type}.`)
    } else if (type === 'hotfix' && /^release/i.test(codeVersion) && /^release\//i.test(branch ?? '')) {
      warnings.push('Marcado como Hotfix numa branch de release. Confira o tipo.')
    }

    const merged = extractTokens(text(row, 'merged'), { linesAreBranches: true })
    const extraCells = row
      .map((c, idx) => (knownIdx.has(idx) ? '' : cellText(c)))
      .filter(Boolean)
      .join('\n')
    const pair = pairColumns(text(row, 'tasks'), [text(row, 'prs'), extraCells].filter(Boolean).join('\n'))

    for (const url of pair.jiraBaseUrls) jiraCounts.set(url, (jiraCounts.get(url) ?? 0) + 1)
    for (const url of pair.repoUrls) repoCounts.set(url, (repoCounts.get(url) ?? 0) + 1)
    const mergedNotes = merged.notes.filter((n) => !merged.branches.includes(n))

    const dupKey = `${codeVersion.toLowerCase()}|${environment}`
    const firstRow = seen.get(dupKey)
    if (firstRow) warnings.push(`Code version repetida (já aparece na linha ${firstRow}).`)
    else seen.set(dupKey, sourceRow)

    const rawSprint = get(row, 'sprint')
    result.deploys.push({
      sourceRow,
      code_version: codeVersion,
      branch: clip(branch, 200),
      environment,
      deployed_on: '',
      sprint: clip(rawSprint === null || rawSprint === undefined ? null : cellText(rawSprint) || null, 60),
      type,
      source_branch: clip(text(row, 'source_branch') || null, 200),
      merged_branches: merged.branches.filter((b) => b.length <= 200).slice(0, 50),
      notes: clip([...pair.notes, ...mergedNotes].join('\n') || null, 2000),
      tasks: [...new Set([...pair.tasks, ...merged.tasks])].slice(0, 200),
      pull_requests: [...pair.pullRequests, ...merged.pullRequests.map((p) => ({ ...p, tasks: [], no_task: false, description: null }))]
        .filter((p) => p.url.length <= 500)
        .slice(0, 200),
      commits: [...pair.commits, ...merged.commits.map((c) => ({ ...c, tasks: [], no_task: false, description: null }))].slice(0, 100),
      warnings,
    })
    rawDates.push(rawDate)
  }

  // Datas resolvidas juntas, pela ordem das linhas, para corrigir dia/mês trocados.
  const resolved = resolveSheetDates(rawDates, referenceDate)
  const kept: ParsedDeploy[] = []
  result.deploys.forEach((d, i) => {
    const date = resolved.dates[i]
    if (!date) {
      result.skipped.push({ sourceRow: d.sourceRow, reason: 'Data inválida.' })
      return
    }
    d.deployed_on = date.iso
    if (resolved.outOfOrder.has(i)) d.warnings.push('Data fora da ordem das linhas. Confira o dia e o mês.')
    kept.push(d)
  })
  result.deploys = kept
  result.unlinkedCount = learnLinks(kept)
  result.skipped.sort((a, b) => a.sourceRow - b.sourceRow)
  result.inferredYearCount = resolved.inferredYearCount
  result.swappedDateCount = resolved.swappedCount

  result.jiraBaseUrl = mostCommon(jiraCounts)
  result.repoUrl = mostCommon(repoCounts)
  return result
}

/**
 * Completa o vínculo de PRs/commits sem task usando outras linhas da aba em que o mesmo PR aparece ligado.
 * @param deploys Deploys da aba (alterados no lugar).
 * @returns Quantos PRs/commits distintos continuam a vincular.
 */
function learnLinks(deploys: ParsedDeploy[]): number {
  const known = new Map<string, { tasks: Set<string>; no_task: boolean; description: string | null }>()
  const refs = (d: ParsedDeploy) => [
    ...d.pull_requests.map((p) => ({ key: `pr:${p.url}`, item: p })),
    ...d.commits.map((c) => ({ key: `c:${c.sha}`, item: c })),
  ]
  for (const d of deploys) {
    for (const { key, item } of refs(d)) {
      if (!item.tasks.length && !item.no_task) continue
      const k = known.get(key) ?? { tasks: new Set<string>(), no_task: false, description: null }
      item.tasks.forEach((t) => k.tasks.add(t))
      k.no_task = k.tasks.size === 0 && (k.no_task || item.no_task)
      k.description = k.description ?? item.description
      known.set(key, k)
    }
  }
  const unlinked = new Set<string>()
  for (const d of deploys) {
    for (const { key, item } of refs(d)) {
      if (item.tasks.length || item.no_task) continue
      const k = known.get(key)
      if (k && (k.tasks.size || k.no_task)) {
        item.tasks = [...k.tasks]
        item.no_task = k.no_task
        item.description = k.description
        d.tasks = [...new Set([...d.tasks, ...item.tasks])]
      } else unlinked.add(key)
    }
  }
  return unlinked.size
}

function clip(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max)
}

function mostCommon(counts: Map<string, number>): string | null {
  let best: string | null = null
  let max = 0
  for (const [k, v] of counts) {
    // Ignora URLs com IDs internos do Bitbucket (%7B...%7D) quando houver alternativa legível.
    const score = k.includes('%7B') ? v / 100 : v
    if (score > max) {
      max = score
      best = k
    }
  }
  return best
}
