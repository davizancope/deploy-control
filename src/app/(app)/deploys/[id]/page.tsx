import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyButton, CopyIconButton } from '@/components/copy-button'
import { EnvBadge, EnvMark, TypeBadge } from '@/components/ui'
import { getDeploy, getMessageTemplate, type DeployDetail } from '@/lib/data'
import { daysBetween, formatDate, formatDayHeading, plural } from '@/lib/format'
import { markdownToHtml, messageVars, renderTemplate, taskUrls } from '@/lib/release-message'
import { requireContext } from '@/lib/session'
import { deleteDeploy } from '../actions'

export const metadata: Metadata = { title: 'Deploy' }

type TaskSummary = {
  task_key: string
  first_staging_on: string | null
  first_production_on: string | null
  staging_deploys: number
  production_deploys: number
}

export default async function DeployPage({ params, searchParams }: PageProps<'/deploys/[id]'>) {
  const ctx = await requireContext()
  const { id } = await params
  const sp = await searchParams
  const [d, template] = await Promise.all([getDeploy(ctx, id), getMessageTemplate(ctx)])
  if (!d) notFound()

  let summaries = new Map<string, TaskSummary>()
  if (d.tasks.length) {
    const { data } = await ctx.supabase
      .from('task_deploy_summary')
      .select('task_key, first_staging_on, first_production_on, staging_deploys, production_deploys')
      .eq('org_id', ctx.org.id)
      .eq('project_id', d.project_id)
      .in('task_key', d.tasks)
    summaries = new Map(((data ?? []) as TaskSummary[]).map((s) => [s.task_key, s]))
  }

  const jira = d.project.jira_base_url
  const refsAll = [...d.pull_requests, ...d.commits]
  const noTask = refsAll.filter((r) => !r.tasks.length && r.no_task)
  const pending = refsAll.filter((r) => !r.tasks.length && !r.no_task)
  const prod = d.environment === 'production'
  const message = renderTemplate(template, messageVars(d))
  const taskLinks = taskUrls(d.tasks, jira).join('\n')

  return (
    <article>
      {sp.salvo && (
        <p role="status" className="mb-6 rounded-xl border border-production/30 bg-production-soft px-3 py-2 text-sm">Deploy salvo.</p>
      )}

      <header className="mb-8 border-b border-line pb-6">
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
          <Link href={`/deploys?projeto=${d.project_id}`} className="link">{d.project.name}</Link>
          <span className="first-letter:uppercase">{formatDayHeading(d.deployed_on)}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="flex min-w-0 items-center gap-3 break-all font-mono text-[26px] font-semibold tracking-tight sm:text-[34px]">
              <span className={prod ? 'text-production' : 'text-staging'}>
                <svg width="22" height="22" viewBox="0 0 10 10" aria-hidden="true">
                  {prod ? <path d="M5 0.5 9.5 5 5 9.5 0.5 5z" fill="currentColor" /> : <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />}
                </svg>
              </span>
              {d.code_version}
            </h1>
            <CopyIconButton text={d.code_version} label="Copiar nome da release" message="Nome da release copiado para a área de transferência." />
          </div>
          <CopyButton text={message} html={markdownToHtml(message)}>Copiar mensagem ao time</CopyButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <EnvBadge env={d.environment} />
          <TypeBadge type={d.type} />
        </div>

        {ctx.canWrite && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {!prod && <Link href={`/deploys/novo?de=${d.id}&ambiente=production`} className="btn-primary">Promover para Produção</Link>}
            <Link href={`/deploys/novo?de=${d.id}`} className="btn-quiet">Novo deploy a partir deste</Link>
            <Link href={`/deploys/${d.id}/editar`} className="btn-quiet">Editar</Link>
            <details className="relative">
              <summary className="btn list-none px-3 text-danger hover:bg-danger-soft [&::-webkit-details-marker]:hidden">Excluir</summary>
              <form action={deleteDeploy} className="absolute z-10 mt-2 w-72 glass-pop rounded-2xl p-4">
                <input type="hidden" name="id" value={d.id} />
                <p className="mb-3 text-sm">Excluir <span className="code">{d.code_version}</span> e as tasks, PRs e commits ligados a ele?</p>
                <button type="submit" className="btn-danger w-full">Excluir deploy</button>
              </form>
            </details>
          </div>
        )}
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="tasks-h" className="space-y-8">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="tasks-h" className="text-lg font-semibold">{plural(d.tasks.length, 'task', 'tasks')}</h2>
              {d.tasks.length > 0 && <CopyButton text={taskLinks} className="btn-quiet py-1.5 text-sm">Copiar links das tasks</CopyButton>}
            </div>
            {d.tasks.length === 0 ? (
              <p className="text-ink-2">Nenhuma task ligada a este deploy.</p>
            ) : (
              <ul className="divide-y divide-line glass rounded-2xl">
                {d.tasks.map((key) => {
                  const s = summaries.get(key)
                  const refs = [...d.pull_requests.filter((p) => p.tasks.includes(key)), ...d.commits.filter((c) => c.tasks.includes(key))]
                  return (
                    <li key={key} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <div className="flex items-center gap-3">
                          <Link href={`/tasks/${key}`} className="code font-medium hover:underline">{key}</Link>
                          {jira && (
                            <a href={`${jira}/browse/${key}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-ink">
                              Jira<span className="sr-only"> (abre em nova aba)</span> ↗
                            </a>
                          )}
                        </div>
                        {s && <TaskStatus s={s} />}
                      </div>
                      {refs.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {refs.map((r) => <li key={'url' in r ? r.url : r.sha}><RefChip item={r} /></li>)}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {noTask.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Sem task</h2>
              <ul className="divide-y divide-line glass rounded-2xl">
                {noTask.map((r) => (
                  <li key={'url' in r ? r.url : r.sha} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <RefChip item={r} />
                    <span className="text-ink-2">{r.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pending.length > 0 && (
            <div className="rounded-2xl border border-warn/40 bg-warn-soft px-4 py-3">
              <h2 className="font-semibold">A vincular</h2>
              <p className="mb-3 text-sm text-ink-2">Não deu para saber de que task são estes PRs ou commits.</p>
              <ul className="mb-3 flex flex-wrap gap-2">
                {pending.map((r) => <li key={'url' in r ? r.url : r.sha}><RefChip item={r} /></li>)}
              </ul>
              {ctx.canWrite && <Link href={`/vincular?projeto=${d.project_id}`} className="btn-quiet py-1.5 text-sm">Vincular agora</Link>}
            </div>
          )}
        </section>

        <aside className="space-y-8">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-[15px]">
            <dt className="text-ink-2">Branch base</dt>
            <dd className="code break-all">{d.branch ?? '—'}</dd>
            <dt className="text-ink-2">Criada a partir da</dt>
            <dd className="code break-all">{d.source_branch ?? '—'}</dd>
            <dt className="text-ink-2">Sprint</dt>
            <dd>{d.sprint ?? '—'}</dd>
            <dt className="text-ink-2">Registrado por</dt>
            <dd>{d.author ?? '—'}</dd>
            <dt className="text-ink-2">Origem</dt>
            <dd>{d.import_batch_id ? 'Importado da planilha' : `Registrado em ${formatDate(d.created_at.slice(0, 10))}`}</dd>
          </dl>

          {d.merged_branches.length > 0 && (
            <div>
              <h2 className="mb-2 font-semibold">Branches incluídas</h2>
              <ul className="code space-y-1 text-sm text-ink-2">
                {d.merged_branches.map((b) => <li key={b} className="break-all">{b}</li>)}
              </ul>
            </div>
          )}

          {d.notes && (
            <div>
              <h2 className="mb-2 font-semibold">Observações</h2>
              <p className="whitespace-pre-line text-ink-2">{d.notes}</p>
            </div>
          )}
        </aside>
      </div>
    </article>
  )
}

function TaskStatus({ s }: { s: TaskSummary }) {
  const rework = s.staging_deploys >= 3
  if (s.first_production_on && s.first_staging_on) {
    const days = daysBetween(s.first_staging_on, s.first_production_on)
    return (
      <span className="flex items-center gap-1.5 text-sm text-production">
        <EnvMark env="production" />
        Em produção desde {formatDate(s.first_production_on, false)}
        <span className="text-muted">({days <= 0 ? 'mesmo dia' : plural(days, 'dia', 'dias')} após staging)</span>
      </span>
    )
  }
  if (s.first_production_on) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-production">
        <EnvMark env="production" /> Em produção desde {formatDate(s.first_production_on, false)}
      </span>
    )
  }
  return (
    <span className={`text-sm ${rework ? 'text-warn' : 'text-ink-2'}`}>
      {plural(s.staging_deploys, 'deploy', 'deploys')} em staging, ainda não foi para produção
    </span>
  )
}

function RefChip({ item }: { item: DeployDetail['pull_requests'][number] | DeployDetail['commits'][number] }) {
  if ('url' in item) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="code inline-block rounded-xl border border-line bg-lift px-2 py-0.5 text-sm hover:border-ink" title={item.description ?? undefined}>
        PR {item.number ? `#${item.number}` : item.url}
      </a>
    )
  }
  return (
    <span className="code inline-block rounded-xl border border-dashed border-line-strong px-2 py-0.5 text-sm" title={item.description ?? undefined}>
      {item.cherry_pick ? 'cherry-pick ' : 'commit '}
      {item.sha.slice(0, 7)}
    </span>
  )
}
