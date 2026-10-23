import type { CommitLink, PrLink } from '@/lib/types'

export const TASK_KEY_RE = /\b([A-Z][A-Z0-9]{1,19}-\d{1,7})\b/g

const PR_URL_RE =
  /(https?:\/\/[^\s/]+\/[^\s]+?\/(?:pull-requests|pull|merge_requests)\/(\d+))(?:[/?#][^\s]*)?/i
const JIRA_URL_RE = /(https?:\/\/[^\s/]+)\/browse\/([A-Z][A-Z0-9]{1,19}-\d{1,7})\b/i
const COMMIT_RE = /^(?:(commit|cherry[\s-]?pick)\s*:?\s*)?([0-9a-f]{7,40})$/i
const COMMIT_LIST_RE = /^(commits?|cherry[\s-]?picks?)\s*:?\s*(.+)$/i
const NO_TASK_RE = /^no\s*-?\s*task\b\s*(.*)$/i
const BARE_KEY_RE = /^([A-Z][A-Z0-9]{1,19}-\d{1,7})$/
const BARE_TASK_NUMBER_RE = /^\d{1,7}$/
const BARE_PR_NUMBER_RE = /^(?:pr\s*)?#?(\d{1,6})$/i
const URL_RE = /^https?:\/\//i

export type Tokens = {
  tasks: string[]
  pullRequests: PrLink[]
  commits: CommitLink[]
  branches: string[]
  notes: string[]
  jiraBaseUrls: string[]
  repoUrls: string[]
}

export type ExtractOptions = {
  /** Linhas que não forem reconhecidas viram branches (coluna "Atualizada com") em vez de observação. */
  linesAreBranches?: boolean
  /** Número solto de PR vira link usando o repositório do projeto. */
  repoUrl?: string | null
  /** Número solto de task vira chave usando o prefixo do Jira do projeto (1184 vira ABC-1184). */
  jiraPrefix?: string | null
}

export function emptyTokens(): Tokens {
  return { tasks: [], pullRequests: [], commits: [], branches: [], notes: [], jiraBaseUrls: [], repoUrls: [] }
}

/**
 * Lê texto livre de uma célula (links de Jira, PRs, commits, branches, "NO TASK") e separa cada coisa.
 * @param text Conteúdo da célula, possivelmente com várias linhas.
 * @param opts Como tratar linhas não reconhecidas e números soltos de PR.
 * @returns Tokens encontrados, sem duplicados.
 */
export function extractTokens(text: string | null | undefined, opts: ExtractOptions = {}): Tokens {
  const out = emptyTokens()
  if (!text) return out

  for (const raw of text.split(/\r?\n|;|,(?=\s*https?:)/)) {
    const line = raw.trim()
    if (!line) continue
    classifyLine(line, out, opts)
  }
  return dedupe(out)
}

function classifyLine(line: string, out: Tokens, opts: ExtractOptions) {
  const pr = line.match(PR_URL_RE)
  if (pr) {
    const url = normalizeUrl(pr[1])
    out.pullRequests.push({ url, number: Number(pr[2]) })
    out.repoUrls.push(url.replace(/\/(?:pull-requests|pull|merge_requests)\/\d+$/i, ''))
    return
  }

  const jira = line.match(JIRA_URL_RE)
  if (jira) {
    out.tasks.push(jira[2].toUpperCase())
    out.jiraBaseUrls.push(normalizeUrl(jira[1]))
    return
  }

  if (URL_RE.test(line)) {
    out.notes.push(line)
    return
  }

  const commitList = line.match(COMMIT_LIST_RE)
  if (commitList) {
    const shas = commitList[2].match(/\b[0-9a-f]{7,40}\b/gi) ?? []
    if (shas.length > 1) {
      const cherry = /cherry/i.test(commitList[1])
      for (const sha of shas) out.commits.push({ sha: sha.toLowerCase(), cherry_pick: cherry })
      return
    }
  }

  const commit = line.match(COMMIT_RE)
  if (commit) {
    // Hash solto só conta se misturar letra e número; com prefixo "commit"/"cherry pick" sempre conta.
    const sha = commit[2]
    if (commit[1] || (/\d/.test(sha) && /[a-f]/i.test(sha))) {
      out.commits.push({ sha: sha.toLowerCase(), cherry_pick: /cherry/i.test(commit[1] ?? '') })
      return
    }
  }

  const noTask = line.match(NO_TASK_RE)
  if (noTask) {
    out.notes.push(noTask[1] ? `Sem task ${noTask[1].trim()}` : 'Sem task')
    return
  }

  const bareKey = line.match(BARE_KEY_RE)
  if (bareKey) {
    out.tasks.push(bareKey[1])
    if (opts.linesAreBranches) out.branches.push(line)
    return
  }

  if (opts.jiraPrefix && BARE_TASK_NUMBER_RE.test(line)) {
    out.tasks.push(`${opts.jiraPrefix}-${Number(line)}`)
    return
  }

  const prNumber = line.match(BARE_PR_NUMBER_RE)
  if (prNumber && opts.repoUrl) {
    const base = opts.repoUrl.replace(/\/+$/, '')
    out.pullRequests.push({ url: `${base}/pull-requests/${prNumber[1]}`, number: Number(prNumber[1]) })
    return
  }

  if (opts.linesAreBranches && !/\s/.test(line)) {
    out.branches.push(line)
    for (const m of line.matchAll(TASK_KEY_RE)) out.tasks.push(m[1])
    return
  }

  out.notes.push(line)
}

function normalizeUrl(url: string): string {
  return url.replace(/^http:\/\//i, 'https://').replace(/\/+$/, '')
}

function uniq<T>(items: T[], key: (t: T) => string = (t) => String(t)): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function dedupe(t: Tokens): Tokens {
  return {
    tasks: uniq(t.tasks),
    pullRequests: uniq(t.pullRequests, (p) => p.url),
    commits: uniq(t.commits, (c) => c.sha),
    branches: uniq(t.branches),
    notes: uniq(t.notes),
    jiraBaseUrls: uniq(t.jiraBaseUrls),
    repoUrls: uniq(t.repoUrls),
  }
}

/**
 * Junta vários conjuntos de tokens num só, sem duplicados.
 * @param parts Tokens extraídos de células diferentes.
 * @returns Tokens combinados.
 */
export function mergeTokens(...parts: Tokens[]): Tokens {
  const all = emptyTokens()
  for (const p of parts) {
    all.tasks.push(...p.tasks)
    all.pullRequests.push(...p.pullRequests)
    all.commits.push(...p.commits)
    all.branches.push(...p.branches)
    all.notes.push(...p.notes)
    all.jiraBaseUrls.push(...p.jiraBaseUrls)
    all.repoUrls.push(...p.repoUrls)
  }
  return dedupe(all)
}
