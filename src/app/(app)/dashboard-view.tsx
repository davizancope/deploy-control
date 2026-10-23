import Link from 'next/link'
import { AutoSubmitSelect } from '@/components/auto-submit-select'
import { ReleaseRail } from '@/components/charts/release-rail'
import { WeeklyBars } from '@/components/charts/weekly-bars'
import { EnvMark, TypeBadge } from '@/components/ui'
import { formatDate, plural } from '@/lib/format'
import type { Insights } from '@/lib/insights'

type Props = {
  ins: Insights
  projects: Array<{ id: string; name: string }>
  projectId: string
  period: string
  periods: Array<{ value: string; label: string }>
  from: string
  to: string
}

/**
 * Corpo do painel: filtros, indicadores, trilho de releases, gráfico semanal e listas de tasks.
 * @param props Indicadores já calculados e filtros ativos.
 * @returns Conteúdo da página do painel.
 */
export function DashboardView({ ins, projects, projectId, period, periods: PERIODS, from, to }: Props) {
  const projectName = new Map(projects.map((p) => [p.id, p.name]))
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Painel</h1>
          <p className="text-ink-2">{formatDate(from)} até hoje{projectId ? `, só ${projectName.get(projectId)}` : ', todos os projetos'}.</p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <label htmlFor="projeto" className="sr-only">Projeto</label>
          <AutoSubmitSelect id="projeto" name="projeto" defaultValue={projectId} className="field w-auto py-1.5">
            <option value="">Todos os projetos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </AutoSubmitSelect>
          <fieldset className="flex rounded-md border border-line-strong bg-surface p-0.5">
            <legend className="sr-only">Período</legend>
            {PERIODS.map((p) => (
              <label key={p.value}>
                <input type="radio" name="periodo" value={p.value} defaultChecked={p.value === period} className="peer sr-only" />
                <span className="block cursor-pointer rounded px-3 py-1 text-sm text-ink-2 peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]">{p.label}</span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn-quiet py-1.5 text-sm">Aplicar</button>
        </form>
      </header>

      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Deploys em produção" value={ins.production.toLocaleString('pt-BR')} note={plural(ins.staging, 'em staging', 'em staging')} />
        <Kpi
          label="Hotfix em produção"
          value={ins.hotfixRate === null ? '—' : `${Math.round(ins.hotfixRate * 100)}%`}
          note={plural(ins.hotfixes, 'hotfix', 'hotfixes')}
          tone={ins.hotfixRate !== null && ins.hotfixRate >= 0.25 ? 'warn' : undefined}
        />
        <Kpi
          label="Staging até produção"
          value={ins.leadTimeMedian === null ? '—' : plural(Math.round(ins.leadTimeMedian), 'dia', 'dias')}
          note={ins.leadTimeSample ? `mediana de ${plural(ins.leadTimeSample, 'task', 'tasks')}` : 'nenhuma task chegou em produção'}
        />
        <Kpi label="Esperando produção" value={String(ins.waiting.length + ins.waitingNoTaskPrs.length)} note={ins.waitingNoTaskPrs.length ? `${ins.waiting.length} tasks, ${ins.waitingNoTaskPrs.length} PRs sem task` : 'tasks que já subiram em staging'} />
        <Kpi
          label="Tasks com retrabalho"
          value={String(ins.rework.length)}
          note="3 ou mais idas a staging"
          tone={ins.rework.length ? 'warn' : undefined}
        />
        <Kpi
          label="PRs sem task"
          value={ins.prsInPeriod ? `${Math.round((ins.prNoTask / ins.prsInPeriod) * 100)}%` : '—'}
          note={ins.prPending ? `${ins.prNoTask} de ${ins.prsInPeriod}; ${ins.prPending} a vincular` : `${ins.prNoTask} de ${plural(ins.prsInPeriod, 'PR', 'PRs')}`}
          href={ins.prPending ? '/vincular' : undefined}
        />
      </dl>

      <div className="space-y-8">
        {ins.lanes.length > 0 ? (
          <ReleaseRail lanes={ins.lanes} from={from} to={to} />
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-ink-2">Nenhum deploy neste período.</p>
        )}

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <WeeklyBars weeks={ins.weeks} />
          <TaskTable
            title="Esperando produção"
            empty="Nenhuma task parada em staging."
            rows={[
              ...ins.waiting.map((t) => ({
                key: t.task_key,
                href: `/tasks/${t.task_key}`,
                days: t.waitingDays,
                project: projectName.get(t.project_id) ?? '—',
                value: plural(t.waitingDays, 'dia', 'dias'),
                detail: `desde ${formatDate(t.first_staging_on!, false)}, ${plural(t.staging_deploys, 'deploy', 'deploys')}`,
              })),
              ...ins.waitingNoTaskPrs.map((p) => ({
                key: `PR #${p.number ?? '?'}`,
                href: p.url,
                days: p.waitingDays,
                project: projectName.get(p.project_id) ?? '—',
                value: plural(p.waitingDays, 'dia', 'dias'),
                detail: `sem task: ${p.description ?? '—'}`,
              })),
            ]
              .sort((a, b) => b.days - a.days)
              .slice(0, 8)}
            more={Math.max(0, ins.waiting.length + ins.waitingNoTaskPrs.length - 8)}
          />
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <TaskTable
            title="Mais idas a staging"
            empty="Nenhuma task com 3 ou mais deploys em staging no período."
            rows={ins.rework.slice(0, 8).map((t) => ({
              key: t.task_key,
              href: `/tasks/${t.task_key}`,
              project: projectName.get(t.project_id) ?? '—',
              value: `${t.staging_deploys}×`,
              detail: t.first_production_on ? `em produção desde ${formatDate(t.first_production_on, false)}` : 'ainda não foi para produção',
            }))}
            more={ins.rework.length > 8 ? ins.rework.length - 8 : 0}
          />
          <section className="rounded-lg border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Últimas em produção</h2>
            {ins.latestProduction.length === 0 ? (
              <p className="px-5 py-6 text-ink-2">Nada foi para produção neste período.</p>
            ) : (
              <ol className="divide-y divide-line">
                {ins.latestProduction.map((d) => (
                  <li key={d.id}>
                    <Link href={`/deploys/${d.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-sunken">
                      <span className={d.type === 'hotfix' ? 'text-hotfix' : 'text-production'}><EnvMark env="production" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="code block truncate">{d.code_version}</span>
                        <span className="block text-sm text-ink-2">{d.project_name}, {formatDate(d.deployed_on, false)}</span>
                      </span>
                      <TypeBadge type={d.type} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, note, tone, href }: { label: string; value: string; note: string; tone?: 'warn'; href?: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={`mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular-nums ${tone === 'warn' ? 'text-hotfix' : ''}`}>{value}</dd>
      <dd className="text-sm text-muted">{href ? <Link href={href} className="link text-muted">{note}</Link> : note}</dd>
    </div>
  )
}

function TaskTable({
  title,
  empty,
  rows,
  more,
}: {
  title: string
  empty: string
  rows: Array<{ key: string; href: string; project: string; value: string; detail: string }>
  more: number
}) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <h2 className="border-b border-line px-5 py-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-ink-2">{empty}</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((r) => (
            <li key={`${r.project}-${r.key}`}>
              <Link
                href={r.href}
                {...(r.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-5 py-2.5 hover:bg-sunken"
              >
                <span className="min-w-0">
                  <span className="code block">{r.key}</span>
                  <span className="block truncate text-sm text-ink-2">{r.project}, {r.detail}</span>
                </span>
                <span className="text-right font-semibold tabular-nums">{r.value}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {more > 0 && <p className="border-t border-line px-5 py-2 text-sm text-muted">E mais {more}.</p>}
    </section>
  )
}

