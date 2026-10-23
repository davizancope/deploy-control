import 'server-only'
import { DEFAULT_MESSAGE_TEMPLATE } from '@/lib/release-message'
import type { AppContext } from '@/lib/session'
import type { DeployType, Environment, LinkedCommit, LinkedPr } from '@/lib/types'

export type Project = {
  id: string
  name: string
  jira_base_url: string | null
  jira_project_prefix: string | null
  repo_url: string | null
  archived: boolean
}

export type DeployListItem = {
  id: string
  project_id: string
  project_name: string
  code_version: string
  branch: string | null
  environment: Environment
  deployed_on: string
  sprint: string | null
  type: DeployType
  task_count: number
  pr_count: number
}

export type DeployDetail = {
  id: string
  project_id: string
  code_version: string
  branch: string | null
  environment: Environment
  deployed_on: string
  sprint: string | null
  type: DeployType
  source_branch: string | null
  merged_branches: string[]
  notes: string | null
  import_batch_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  tasks: string[]
  pull_requests: Array<LinkedPr & { id: string }>
  commits: Array<LinkedCommit & { id: string }>
  project: Project
  author: string | null
}

export type DeployFilters = {
  project?: string
  env?: Environment
  type?: DeployType
  q?: string
  from?: string
  to?: string
  page?: number
}

export const PAGE_SIZE = 60

/**
 * Projetos da organização ativa.
 * @param ctx Contexto da requisição.
 * @param includeArchived Inclui projetos arquivados.
 * @returns Lista ordenada por nome.
 */
export async function listProjects(ctx: AppContext, includeArchived = false): Promise<Project[]> {
  let query = ctx.supabase
    .from('projects')
    .select('id, name, jira_base_url, jira_project_prefix, repo_url, archived')
    .eq('org_id', ctx.org.id)
    .order('name')
  if (!includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  if (error) throw new Error(`Erro ao carregar projetos: ${error.message}`)
  return (data ?? []) as Project[]
}

const SAFE_SEARCH = /[^A-Za-z0-9._/\-]/g

/**
 * Busca deploys com filtros e paginação.
 * @param ctx Contexto da requisição.
 * @param f Filtros vindos da URL.
 * @returns Itens da página e se há mais.
 */
export async function listDeploys(ctx: AppContext, f: DeployFilters): Promise<{ items: DeployListItem[]; hasMore: boolean }> {
  const page = Math.max(1, f.page ?? 1)
  let query = ctx.supabase
    .from('deployments')
    .select(
      'id, project_id, code_version, branch, environment, deployed_on, sprint, type, projects(name), deployment_tasks(count), deployment_pull_requests(count)',
    )
    .eq('org_id', ctx.org.id)
    .order('deployed_on', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (f.project) query = query.eq('project_id', f.project)
  if (f.env) query = query.eq('environment', f.env)
  if (f.type) query = query.eq('type', f.type)
  if (f.from) query = query.gte('deployed_on', f.from)
  if (f.to) query = query.lte('deployed_on', f.to)

  const q = (f.q ?? '').replace(SAFE_SEARCH, '').trim()
  if (q) {
    const key = q.toUpperCase()
    if (/^[A-Z][A-Z0-9]{1,19}-\d{1,7}$/.test(key)) {
      const ids = await deployIdsForTask(ctx, key)
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    } else {
      query = query.or(`code_version.ilike.*${q}*,branch.ilike.*${q}*`)
    }
  }

  const { data, error } = await query
  if (error) throw new Error(`Erro ao carregar deploys: ${error.message}`)
  const rows = (data ?? []) as unknown as Array<
    Omit<DeployListItem, 'project_name' | 'task_count' | 'pr_count'> & {
      projects: { name: string } | null
      deployment_tasks: { count: number }[]
      deployment_pull_requests: { count: number }[]
    }
  >
  const items = rows.slice(0, PAGE_SIZE).map(({ projects, deployment_tasks, deployment_pull_requests, ...d }) => ({
    ...d,
    project_name: projects?.name ?? '—',
    task_count: deployment_tasks?.[0]?.count ?? 0,
    pr_count: deployment_pull_requests?.[0]?.count ?? 0,
  }))
  return { items, hasMore: rows.length > PAGE_SIZE }
}

async function deployIdsForTask(ctx: AppContext, key: string): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from('deployment_tasks')
    .select('deployment_id')
    .eq('org_id', ctx.org.id)
    .eq('task_key', key)
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.deployment_id as string)
}

/**
 * Deploy completo, com tasks, PRs, commits, projeto e autor.
 * @param ctx Contexto da requisição.
 * @param id ID do deploy.
 * @returns O deploy ou null se não existir (ou for de outra organização).
 */
export async function getDeploy(ctx: AppContext, id: string): Promise<DeployDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await ctx.supabase
    .from('deployments')
    .select(
      `id, project_id, code_version, branch, environment, deployed_on, sprint, type, source_branch, merged_branches, notes,
       import_batch_id, created_at, updated_at, created_by,
       projects(id, name, jira_base_url, jira_project_prefix, repo_url, archived),
       deployment_tasks(task_key),
       deployment_pull_requests(pull_requests(id, url, number, description, no_task, pull_request_tasks(task_key))),
       deployment_commits(cherry_pick, commits(id, sha, description, no_task, commit_tasks(task_key)))`,
    )
    .eq('org_id', ctx.org.id)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`Erro ao carregar o deploy: ${error.message}`)
  if (!data) return null

  const d = data as unknown as Omit<DeployDetail, 'tasks' | 'pull_requests' | 'commits' | 'project' | 'author'> & {
    projects: Project
    deployment_tasks: { task_key: string }[]
    deployment_pull_requests: Array<{
      pull_requests: { id: string; url: string; number: number | null; description: string | null; no_task: boolean; pull_request_tasks: { task_key: string }[] }
    }>
    deployment_commits: Array<{
      cherry_pick: boolean
      commits: { id: string; sha: string; description: string | null; no_task: boolean; commit_tasks: { task_key: string }[] }
    }>
  }

  let author: string | null = null
  if (d.created_by) {
    const { data: p } = await ctx.supabase.from('profiles').select('full_name, email').eq('id', d.created_by).maybeSingle()
    author = (p?.full_name as string | null) || (p?.email as string | null) || null
  }

  const { projects, deployment_tasks, deployment_pull_requests, deployment_commits, ...rest } = d
  return {
    ...rest,
    project: projects,
    tasks: deployment_tasks.map((t) => t.task_key).sort(compareTaskKeys),
    pull_requests: deployment_pull_requests
      .map(({ pull_requests: p }) => ({
        id: p.id,
        url: p.url,
        number: p.number,
        description: p.description,
        no_task: p.no_task,
        tasks: p.pull_request_tasks.map((t) => t.task_key).sort(compareTaskKeys),
      }))
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    commits: deployment_commits.map(({ cherry_pick, commits: c }) => ({
      id: c.id,
      sha: c.sha,
      cherry_pick,
      description: c.description,
      no_task: c.no_task,
      tasks: c.commit_tasks.map((t) => t.task_key).sort(compareTaskKeys),
    })),
    author,
  }
}

/**
 * Modelo da mensagem ao time da organização ativa.
 * @param ctx Contexto da requisição.
 * @returns Texto salvo, ou o modelo padrão enquanto não houver um salvo.
 */
export async function getMessageTemplate(ctx: AppContext): Promise<string> {
  const { data, error } = await ctx.supabase.from('deploy_message_templates').select('body').eq('org_id', ctx.org.id).maybeSingle()
  if (error) throw new Error(`Erro ao carregar a mensagem ao time: ${error.message}`)
  return (data?.body as string | undefined) ?? DEFAULT_MESSAGE_TEMPLATE
}

/**
 * Ordena chaves de task pelo prefixo e depois pelo número.
 * @param a Chave A.
 * @param b Chave B.
 * @returns Comparação para sort.
 */
export function compareTaskKeys(a: string, b: string): number {
  const [pa, na] = a.split('-')
  const [pb, nb] = b.split('-')
  return pa === pb ? Number(na) - Number(nb) : pa.localeCompare(pb)
}

export type TaskTimelineItem = {
  id: string
  code_version: string
  environment: Environment
  deployed_on: string
  type: DeployType
  project_id: string
  project_name: string
  jira_base_url: string | null
}

/**
 * Todos os deploys que levaram uma task, do mais antigo ao mais novo.
 * @param ctx Contexto da requisição.
 * @param key Chave da task (ex.: ABC-123).
 * @returns Linha do tempo da task.
 */
export async function getTaskTimeline(ctx: AppContext, key: string): Promise<TaskTimelineItem[]> {
  const ids = await deployIdsForTask(ctx, key)
  if (!ids.length) return []
  const { data, error } = await ctx.supabase
    .from('deployments')
    .select('id, code_version, environment, deployed_on, type, project_id, projects(name, jira_base_url)')
    .eq('org_id', ctx.org.id)
    .in('id', ids)
    .order('deployed_on')
    .order('created_at')
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<Omit<TaskTimelineItem, 'project_name' | 'jira_base_url'> & { projects: { name: string; jira_base_url: string | null } | null }>).map(
    ({ projects, ...d }) => ({ ...d, project_name: projects?.name ?? '—', jira_base_url: projects?.jira_base_url ?? null }),
  )
}

/**
 * Último code version registrado em cada projeto (ajuda a sugerir o próximo).
 * @param ctx Contexto da requisição.
 * @returns Mapa projeto → code version mais recente.
 */
export async function latestVersionByProject(ctx: AppContext): Promise<Record<string, { code_version: string; deployed_on: string }>> {
  const { data, error } = await ctx.supabase
    .from('deployments')
    .select('project_id, code_version, deployed_on')
    .eq('org_id', ctx.org.id)
    .order('deployed_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(400)
  if (error) throw new Error(error.message)
  const out: Record<string, { code_version: string; deployed_on: string }> = {}
  for (const r of data ?? []) {
    if (!out[r.project_id as string]) out[r.project_id as string] = { code_version: r.code_version as string, deployed_on: r.deployed_on as string }
  }
  return out
}

/**
 * Busca todas as páginas de uma consulta (o Supabase devolve no máximo 1000 linhas por vez).
 * @param page Função que monta a consulta para o intervalo [from, to].
 * @param max Limite de segurança de linhas.
 * @returns Todas as linhas.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  max = 20000,
): Promise<T[]> {
  const size = 1000
  const rows: T[] = []
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return rows
}

export type KnownLink = { ref: string; number: number | null; tasks: string[]; no_task: boolean; description: string | null }

/**
 * PRs e commits já vinculados por projeto, para o formulário preencher a task sozinho.
 * @param ctx Contexto da requisição.
 * @returns Mapa projeto → lista de PRs (url) e commits (sha) com suas tasks.
 */
export async function knownLinksByProject(ctx: AppContext): Promise<Record<string, KnownLink[]>> {
  const [prs, commits] = await Promise.all([
    ctx.supabase
      .from('pull_request_summary')
      .select('project_id, url, number, tasks, no_task, description')
      .eq('org_id', ctx.org.id)
      .neq('link_status', 'pending')
      .order('last_deployed_on', { ascending: false, nullsFirst: false })
      .limit(1000),
    ctx.supabase
      .from('commit_summary')
      .select('project_id, sha, tasks, no_task, description')
      .eq('org_id', ctx.org.id)
      .neq('link_status', 'pending')
      .limit(1000),
  ])
  if (prs.error) throw new Error(prs.error.message)
  if (commits.error) throw new Error(commits.error.message)
  const out: Record<string, KnownLink[]> = {}
  for (const p of prs.data ?? []) {
    ;(out[p.project_id as string] ??= []).push({ ref: p.url as string, number: p.number as number | null, tasks: p.tasks as string[], no_task: p.no_task as boolean, description: p.description as string | null })
  }
  for (const c of commits.data ?? []) {
    ;(out[c.project_id as string] ??= []).push({ ref: c.sha as string, number: null, tasks: c.tasks as string[], no_task: c.no_task as boolean, description: c.description as string | null })
  }
  return out
}
