import { formatDate } from '@/lib/format'
import { ENVIRONMENT_LABEL, TYPE_LABEL, type DeployType, type Environment } from '@/lib/types'

/** Modelo usado enquanto a organização não salvou o próprio. */
export const DEFAULT_MESSAGE_TEMPLATE = [
  'Olá time,',
  '',
  'A release **{{release}}** foi publicada em **{{ambiente}}**.',
  '',
  'As seguintes tarefas foram incluídas no deploy:',
  '{{tarefas}}',
].join('\n')

/** Campos que o modelo pode usar, no formato {{campo}}. */
export const MESSAGE_PLACEHOLDERS = [
  { key: 'release', description: 'Nome da release (code version)' },
  { key: 'ambiente', description: 'Staging ou Produção' },
  { key: 'projeto', description: 'Nome do projeto' },
  { key: 'tipo', description: 'Release, Hotfix ou Bugfix' },
  { key: 'data', description: 'Data do deploy, como 21 out 2026' },
  { key: 'sprint', description: 'Sprint do deploy' },
  { key: 'branch', description: 'Branch base do deploy' },
  { key: 'tarefas', description: 'Uma task por linha, cada uma com link do Jira; PRs e commits sem task entram com a descrição e o link, e sem nada disso, as observações do deploy' },
  { key: 'tarefas_urls', description: 'Uma task por linha, só a URL do Jira; PRs e commits sem task entram só com a URL' },
] as const

export type PlaceholderKey = (typeof MESSAGE_PLACEHOLDERS)[number]['key']
export type MessageVars = Record<PlaceholderKey, string>

/** Dados do deploy que a mensagem usa; DeployDetail já tem esse formato. */
export type MessageDeploy = {
  code_version: string
  environment: Environment
  deployed_on: string
  type: DeployType
  sprint: string | null
  branch: string | null
  tasks: string[]
  notes: string | null
  pull_requests: Array<{ url: string; number: number | null; description: string | null; tasks: string[]; no_task: boolean }>
  commits: Array<{ sha: string; description: string | null; tasks: string[]; no_task: boolean }>
  project: { name: string; jira_base_url: string | null; repo_url: string | null }
}

/** Deploy fictício para a prévia da página de configuração. */
export const SAMPLE_DEPLOY: MessageDeploy = {
  code_version: 'release_2026-10-21',
  environment: 'production',
  deployed_on: '2026-10-21',
  type: 'release',
  sprint: 'Sprint 42',
  branch: 'release/2026-10-21',
  tasks: ['ABC-101', 'ABC-102'],
  notes: null,
  pull_requests: [],
  commits: [],
  project: { name: 'Projeto Exemplo', jira_base_url: 'https://empresa.atlassian.net', repo_url: null },
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/gi
const NO_TASKS = '- Nenhuma task vinculada'

/**
 * Endereço de cada task no Jira; sem Jira configurado no projeto, devolve só a chave.
 * @param tasks Chaves das tasks (ex.: ABC-123).
 * @param jiraBaseUrl Endereço base do Jira do projeto, sem barra no final.
 * @returns Um item por task, na mesma ordem.
 */
export function taskUrls(tasks: string[], jiraBaseUrl: string | null): string[] {
  return tasks.map((key) => (jiraBaseUrl ? `${jiraBaseUrl}/browse/${key}` : key))
}

/** PR ou commit do deploy, com o link quando dá para montá-lo. */
type ChangeRef = { label: string; url: string | null; description: string | null; tasks: string[]; no_task: boolean }

/**
 * Endereço de um commit no repositório do projeto.
 * @param repoUrl Repositório do projeto (Bitbucket, GitLab ou estilo GitHub).
 * @param sha Hash do commit.
 * @returns A URL, ou null se o projeto não tem repositório cadastrado.
 */
export function commitUrl(repoUrl: string | null, sha: string): string | null {
  if (!repoUrl) return null
  const base = repoUrl.replace(/\/+$/, '').replace(/\.git$/, '')
  if (/bitbucket\./i.test(base)) return `${base}/commits/${sha}`
  if (/gitlab/i.test(base)) return `${base}/-/commit/${sha}`
  return `${base}/commit/${sha}`
}

/**
 * PRs e commits do deploy, na ordem em que a mensagem os lista.
 * @param d Deploy com PRs, commits e projeto.
 * @returns PRs primeiro, depois commits.
 */
function changeRefs(d: MessageDeploy): ChangeRef[] {
  const prs = d.pull_requests.map((p) => ({ label: p.number ? `PR #${p.number}` : 'PR', url: p.url, description: p.description, tasks: p.tasks, no_task: p.no_task }))
  const commits = d.commits.map((c) => ({
    label: `commit ${c.sha.slice(0, 7)}`,
    url: commitUrl(d.project.repo_url, c.sha),
    description: c.description,
    tasks: c.tasks,
    no_task: c.no_task,
  }))
  return [...prs, ...commits]
}

/**
 * PRs e commits marcados como "sem task", que entram na mensagem com a descrição e o link.
 * @param d Deploy com PRs, commits e projeto.
 * @returns Só os que não têm task e foram marcados como sem task (os "a vincular" ficam de fora).
 */
function noTaskRefs(d: MessageDeploy): ChangeRef[] {
  return changeRefs(d).filter((r) => !r.tasks.length && r.no_task)
}

/**
 * Link em markdown de um PR ou commit; sem URL (commit sem repositório) fica só o rótulo.
 * @param r PR ou commit.
 * @returns Texto do link.
 */
function refLink(r: ChangeRef): string {
  return r.url ? `[${r.label}](${r.url})` : r.label
}

/**
 * Lista da mensagem quando não há task nem PR/commit marcado como sem task: as observações com o link do PR ou commit.
 * @param d Deploy sem tasks.
 * @returns Itens em markdown; sem observações usa a descrição de cada PR/commit, e sem nada diz que não há task.
 */
function noTaskItems(d: MessageDeploy): string {
  const refs = changeRefs(d)
  const notes = (d.notes ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s+/, ''))
    .filter(Boolean)
  if (notes.length) {
    const links = refs.map(refLink).join(', ')
    return notes.map((line, i) => `- ${line}${links && i === notes.length - 1 ? ` (${links})` : ''}`).join('\n')
  }
  if (!refs.length) return NO_TASKS
  return refs.map((r) => `- ${r.description ? `${r.description} (${refLink(r)})` : refLink(r)}`).join('\n')
}

/**
 * URLs dos PRs e commits quando não há task nem PR/commit marcado como sem task.
 * @param d Deploy sem tasks.
 * @returns Uma URL por linha, ou o aviso de que não há task se nenhuma puder ser montada.
 */
function noTaskUrls(d: MessageDeploy): string {
  const urls = changeRefs(d).flatMap((r) => (r.url ? [`- ${r.url}`] : []))
  return urls.length ? urls.join('\n') : NO_TASKS
}

/**
 * Valores de cada campo do modelo para um deploy.
 * @param d Deploy com projeto e tasks.
 * @returns Mapa campo → texto.
 */
export function messageVars(d: MessageDeploy): MessageVars {
  const jira = d.project.jira_base_url
  const urls = taskUrls(d.tasks, jira)
  const untasked = noTaskRefs(d)
  const taskLines = [
    ...d.tasks.map((key, i) => (jira ? `- [${key}](${urls[i]})` : `- ${key}`)),
    ...untasked.map((r) => `- ${r.description ? `${r.description} (${refLink(r)})` : refLink(r)}`),
  ]
  const urlLines = [...urls, ...untasked.flatMap((r) => (r.url ? [r.url] : []))].map((u) => `- ${u}`)
  return {
    release: d.code_version,
    ambiente: ENVIRONMENT_LABEL[d.environment],
    projeto: d.project.name,
    tipo: TYPE_LABEL[d.type],
    data: formatDate(d.deployed_on),
    sprint: d.sprint ?? '—',
    branch: d.branch ?? '—',
    tarefas: taskLines.length ? taskLines.join('\n') : noTaskItems(d),
    tarefas_urls: urlLines.length ? urlLines.join('\n') : noTaskUrls(d),
  }
}

/**
 * Preenche os campos {{campo}} do modelo; campos desconhecidos ficam como escritos para o erro aparecer.
 * @param template Texto do modelo.
 * @param vars Valores por campo.
 * @returns Mensagem em markdown.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const key = name.toLowerCase()
    return Object.hasOwn(vars, key) ? vars[key] : whole
  })
}

/**
 * Campos {{campo}} do modelo que não existem.
 * @param template Texto do modelo.
 * @returns Nomes sem repetição, na ordem em que aparecem.
 */
export function findUnknownPlaceholders(template: string): string[] {
  const known = new Set<string>(MESSAGE_PLACEHOLDERS.map((p) => p.key))
  const unknown = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = match[1].toLowerCase()
    if (!known.has(key)) unknown.add(key)
  }
  return [...unknown]
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const INLINE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)\S)+)/g

/**
 * Escapa os caracteres especiais do HTML.
 * @param text Texto puro.
 * @returns Texto seguro para entrar em HTML.
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
}

/**
 * Converte o markdown inline (negrito, link e URL solta) de uma linha.
 * @param line Linha em texto puro.
 * @returns HTML da linha, com todo o resto escapado.
 */
function inlineToHtml(line: string): string {
  return escapeHtml(line).replace(INLINE, (_m, label?: string, href?: string, bold?: string, bare?: string) => {
    if (href) return `<a href="${href}">${label}</a>`
    if (bold) return `<strong>${bold}</strong>`
    const url = (bare as string).replace(/[.,:!?]+$/, '')
    return `<a href="${url}">${url}</a>${(bare as string).slice(url.length)}`
  })
}

/**
 * Converte o subconjunto de markdown da mensagem (parágrafos, listas com "-", **negrito**, [texto](url) e URLs) em HTML.
 * @param markdown Mensagem já preenchida.
 * @returns HTML sem tags vindas do texto; só há links http(s).
 */
export function markdownToHtml(markdown: string): string {
  const blocks: string[] = []
  let list: string[] = []
  let paragraph: string[] = []
  const flushList = () => {
    if (list.length) blocks.push(`<ul>${list.map((item) => `<li>${item}</li>`).join('')}</ul>`)
    list = []
  }
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.join('<br>')}</p>`)
    paragraph = []
  }
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const item = /^\s*[-*]\s+(.*)$/.exec(line)
    if (item) {
      flushParagraph()
      list.push(inlineToHtml(item[1]))
    } else if (line.trim() === '') {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(inlineToHtml(line))
    }
  }
  flushParagraph()
  flushList()
  return blocks.join('')
}
