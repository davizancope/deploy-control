import type { Metadata } from 'next'
import Link from 'next/link'
import { EnvMark, TypeBadge } from '@/components/ui'
import { listDeploys, listProjects, type DeployFilters } from '@/lib/data'
import { formatDayHeading, plural } from '@/lib/format'
import { requireContext } from '@/lib/session'
import type { DeployType, Environment } from '@/lib/types'

export const metadata: Metadata = { title: 'Deploys' }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function readFilters(sp: Record<string, string | string[] | undefined>): DeployFilters {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const env = one('ambiente')
  const type = one('tipo')
  return {
    project: one('projeto') && /^[0-9a-f-]{36}$/i.test(one('projeto')!) ? one('projeto') : undefined,
    env: env === 'staging' || env === 'production' ? (env as Environment) : undefined,
    type: type === 'release' || type === 'hotfix' || type === 'bugfix' ? (type as DeployType) : undefined,
    q: one('q')?.slice(0, 80),
    from: one('de') && ISO_DATE.test(one('de')!) ? one('de') : undefined,
    to: one('ate') && ISO_DATE.test(one('ate')!) ? one('ate') : undefined,
    page: Number(one('pagina')) || 1,
  }
}

export default async function DeploysPage({ searchParams }: PageProps<'/deploys'>) {
  const ctx = await requireContext()
  const sp = await searchParams
  const filters = readFilters(sp)
  const [projects, { items, hasMore }] = await Promise.all([listProjects(ctx, true), listDeploys(ctx, filters)])

  const groups = new Map<string, typeof items>()
  for (const d of items) groups.set(d.deployed_on, [...(groups.get(d.deployed_on) ?? []), d])
  const filtered = Boolean(filters.project || filters.env || filters.type || filters.q || filters.from || filters.to)
  const nextPage = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === 'string') as [string, string][])
  nextPage.set('pagina', String((filters.page ?? 1) + 1))

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Deploys</h1>
          <p className="text-ink-2">Tudo o que subiu, do mais recente para o mais antigo.</p>
        </div>
        {ctx.canWrite && <Link href="/deploys/novo" className="btn-primary">Registrar deploy</Link>}
      </header>

      <form className="mb-8 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_auto]" role="search">
        <div>
          <label className="label" htmlFor="q">Code version, branch ou task</label>
          <input className="field code" id="q" name="q" defaultValue={filters.q} placeholder="release_4_2 ou ABC-123" />
        </div>
        <div>
          <label className="label" htmlFor="projeto">Projeto</label>
          <select className="field" id="projeto" name="projeto" defaultValue={filters.project ?? ''}>
            <option value="">Todos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ambiente">Ambiente</label>
          <select className="field" id="ambiente" name="ambiente" defaultValue={filters.env ?? ''}>
            <option value="">Todos</option>
            <option value="staging">Staging</option>
            <option value="production">Produção</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tipo">Tipo</label>
          <select className="field" id="tipo" name="tipo" defaultValue={filters.type ?? ''}>
            <option value="">Todos</option>
            <option value="release">Release</option>
            <option value="hotfix">Hotfix</option>
            <option value="bugfix">Bugfix</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="de">De</label>
          <input className="field" id="de" name="de" type="date" defaultValue={filters.from} />
        </div>
        <div>
          <label className="label" htmlFor="ate">Até</label>
          <input className="field" id="ate" name="ate" type="date" defaultValue={filters.to} />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-quiet">Filtrar</button>
          {filtered && <Link href="/deploys" className="btn px-2 text-ink-2 hover:text-ink">Limpar</Link>}
        </div>
      </form>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
          {filtered ? (
            <p className="text-ink-2">Nenhum deploy com esses filtros. <Link href="/deploys" className="link">Limpar filtros</Link></p>
          ) : (
            <>
              <p className="mb-4 text-ink-2">Nenhum deploy registrado ainda.</p>
              <div className="flex justify-center gap-3">
                {ctx.canWrite && <Link href="/deploys/novo" className="btn-primary">Registrar o primeiro</Link>}
                <Link href="/importar" className="btn-quiet">Importar a planilha</Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day} aria-labelledby={`d-${day}`}>
              <h2 id={`d-${day}`} className="mb-2 flex items-baseline gap-3 text-sm text-ink-2">
                <span className="font-semibold text-ink first-letter:uppercase">{formatDayHeading(day)}</span>
                <span>{plural(list.length, 'deploy', 'deploys')}</span>
              </h2>
              <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {list.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/deploys/${d.id}`}
                      className="grid grid-cols-[20px_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-sunken sm:grid-cols-[20px_minmax(0,2.2fr)_minmax(0,1fr)_110px_120px]"
                    >
                      <span className={d.environment === 'production' ? 'text-production' : 'text-staging'} title={d.environment === 'production' ? 'Produção' : 'Staging'}>
                        <EnvMark env={d.environment} />
                        <span className="sr-only">{d.environment === 'production' ? 'Produção' : 'Staging'}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="code block truncate font-medium">{d.code_version}</span>
                        <span className="code block truncate text-sm text-muted">{d.branch ?? '—'}</span>
                      </span>
                      <span className="col-start-2 truncate text-sm text-ink-2 sm:col-start-auto">{d.project_name}{d.sprint ? `, sprint ${d.sprint}` : ''}</span>
                      <span className="row-start-1 justify-self-end sm:row-start-auto sm:justify-self-start"><TypeBadge type={d.type} /></span>
                      <span className="col-start-3 row-start-2 justify-self-end text-sm text-muted sm:col-start-auto sm:row-start-auto">
                        {plural(d.task_count, 'task', 'tasks')}, {d.pr_count} PR
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {hasMore && (
            <div className="text-center">
              <Link href={`/deploys?${nextPage}`} className="btn-quiet">Ver deploys mais antigos</Link>
            </div>
          )}
        </div>
      )}
    </>
  )
}
