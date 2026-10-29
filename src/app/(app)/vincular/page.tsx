import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { compareTaskKeys, listProjects } from '@/lib/data'
import { formatDate, plural } from '@/lib/format'
import { requireContext } from '@/lib/session'
import { LinkForm } from './link-form'

export const metadata: Metadata = { title: 'Vincular PRs' }

type PendingPr = { id: string; project_id: string; url: string; number: number | null; last_deployed_on: string | null }
type PendingCommit = { id: string; project_id: string; sha: string; last_deployed_on: string | null }
type DeployRef = { id: string; code_version: string; deployed_on: string; environment: string; deployment_tasks: { task_key: string }[] }

export default async function LinkPage({ searchParams }: PageProps<'/vincular'>) {
  const ctx = await requireContext()
  if (!ctx.canWrite) redirect('/')
  const sp = await searchParams
  const projects = await listProjects(ctx, true)
  const projectId = typeof sp.projeto === 'string' && projects.some((p) => p.id === sp.projeto) ? sp.projeto : ''

  let prQuery = ctx.supabase
    .from('pull_request_summary')
    .select('id, project_id, url, number, last_deployed_on')
    .eq('org_id', ctx.org.id)
    .eq('link_status', 'pending')
    .order('last_deployed_on', { ascending: false, nullsFirst: false })
    .limit(200)
  let commitQuery = ctx.supabase
    .from('commit_summary')
    .select('id, project_id, sha, last_deployed_on')
    .eq('org_id', ctx.org.id)
    .eq('link_status', 'pending')
    .order('last_deployed_on', { ascending: false, nullsFirst: false })
    .limit(200)
  if (projectId) {
    prQuery = prQuery.eq('project_id', projectId)
    commitQuery = commitQuery.eq('project_id', projectId)
  }
  const [{ data: prRows, error: e1 }, { data: commitRows, error: e2 }] = await Promise.all([prQuery, commitQuery])
  if (e1 || e2) throw new Error((e1 ?? e2)!.message)
  const prs = (prRows ?? []) as PendingPr[]
  const commits = (commitRows ?? []) as PendingCommit[]

  const [{ data: prDeploys }, { data: commitDeploys }] = await Promise.all([
    prs.length
      ? ctx.supabase
          .from('deployment_pull_requests')
          .select('pull_request_id, deployments(id, code_version, deployed_on, environment, deployment_tasks(task_key))')
          .in('pull_request_id', prs.map((p) => p.id))
      : Promise.resolve({ data: [] }),
    commits.length
      ? ctx.supabase
          .from('deployment_commits')
          .select('commit_id, deployments(id, code_version, deployed_on, environment, deployment_tasks(task_key))')
          .in('commit_id', commits.map((c) => c.id))
      : Promise.resolve({ data: [] }),
  ])
  const deploysOf = new Map<string, DeployRef[]>()
  for (const r of (prDeploys ?? []) as unknown as Array<{ pull_request_id: string; deployments: DeployRef }>) {
    deploysOf.set(r.pull_request_id, [...(deploysOf.get(r.pull_request_id) ?? []), r.deployments])
  }
  for (const r of (commitDeploys ?? []) as unknown as Array<{ commit_id: string; deployments: DeployRef }>) {
    deploysOf.set(r.commit_id, [...(deploysOf.get(r.commit_id) ?? []), r.deployments])
  }

  const projectName = new Map(projects.map((p) => [p.id, p.name]))
  const items = [
    ...prs.map((p) => ({ kind: 'pr' as const, id: p.id, project_id: p.project_id, label: `PR #${p.number ?? '?'}`, href: p.url, last: p.last_deployed_on })),
    ...commits.map((c) => ({ kind: 'commit' as const, id: c.id, project_id: c.project_id, label: `commit ${c.sha.slice(0, 7)}`, href: null, last: c.last_deployed_on })),
  ].sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''))

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Vincular PRs</h1>
        <p className="max-w-[70ch] text-ink-2">
          PRs e commits que vieram sem task definida, geralmente de linhas da planilha com quantidades diferentes de tasks e PRs.
          As sugestões são as tasks dos deploys em que cada um subiu.
        </p>
      </header>

      <form className="mb-6 flex items-end gap-2">
        <div>
          <label className="label" htmlFor="projeto">Projeto</label>
          <select id="projeto" name="projeto" defaultValue={projectId} className="field w-auto">
            <option value="">Todos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-quiet">Filtrar</button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
          <p className="text-ink-2">Tudo vinculado. Todo PR e commit tem task ou está marcado como sem task.</p>
          <Link href="/deploys" className="link mt-2 inline-block">Ver deploys</Link>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-2">{plural(items.length, 'item a vincular', 'itens a vincular')}</p>
          <ul className="space-y-4">
            {items.map((item) => {
              const deploys = (deploysOf.get(item.id) ?? []).sort((a, b) => a.deployed_on.localeCompare(b.deployed_on))
              const candidates = [...new Set(deploys.flatMap((d) => d.deployment_tasks.map((t) => t.task_key)))].sort(compareTaskKeys)
              return (
                <li key={item.id} className="glass rounded-2xl p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex items-baseline gap-3">
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noopener noreferrer" className="code text-lg font-semibold hover:underline">{item.label} ↗</a>
                      ) : (
                        <span className="code text-lg font-semibold">{item.label}</span>
                      )}
                      <span className="text-sm text-ink-2">{projectName.get(item.project_id)}</span>
                    </span>
                    <span className="text-sm text-ink-2">
                      Subiu em{' '}
                      {deploys.map((d, i) => (
                        <span key={d.id}>
                          {i > 0 && ', '}
                          <Link href={`/deploys/${d.id}`} className="code hover:underline">{d.code_version}</Link> ({formatDate(d.deployed_on, false)})
                        </span>
                      ))}
                    </span>
                  </div>
                  <LinkForm kind={item.kind} id={item.id} candidates={candidates} />
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
