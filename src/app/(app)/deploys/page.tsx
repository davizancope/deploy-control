import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { EnvMark, MetadataBadge, TypeBadge } from '@/components/ui'
import { listDeploys, listProjects, type DeployFilters } from '@/lib/data'
import { formatDayHeading, plural } from '@/lib/format'
import { DEPLOY_REFS_COOKIE, DEPLOY_REFS_HIDDEN } from '@/lib/prefs'
import { requireContext } from '@/lib/session'
import type { DeployType, Environment } from '@/lib/types'
import { DeployFilterBar } from './filter-bar'
import { CardRefs } from './card-refs'
import { DeployRefsToggle } from './refs-toggle'

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
  const refsShown = (await cookies()).get(DEPLOY_REFS_COOKIE)?.value !== DEPLOY_REFS_HIDDEN
  const [projects, { items, hasMore }] = await Promise.all([listProjects(ctx), listDeploys(ctx, filters)])

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

      <DeployFilterBar
        values={{ q: filters.q ?? '', projeto: filters.project ?? '', ambiente: filters.env ?? '', tipo: filters.type ?? '', de: filters.from ?? '', ate: filters.to ?? '' }}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        filtered={filtered}
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
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
        <DeployRefsToggle initialShown={refsShown}>
          <div className="space-y-8">
            {[...groups.entries()].map(([day, list]) => (
              <section key={day} aria-labelledby={`d-${day}`}>
                <h2 id={`d-${day}`} className="mb-2 flex items-baseline gap-3 text-sm text-ink-2">
                  <span className="font-semibold text-ink first-letter:uppercase">{formatDayHeading(day)}</span>
                  <span>{plural(list.length, 'deploy', 'deploys')}</span>
                </h2>
                <ol className="divide-y divide-line overflow-hidden glass rounded-2xl">
                  {list.map((d) => (
                    <li key={d.id} className="relative hover:bg-sunken">
                      <Link
                        href={`/deploys/${d.id}`}
                        className="grid grid-cols-[20px_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 after:absolute after:inset-0 sm:grid-cols-[20px_minmax(0,2.2fr)_minmax(0,1fr)_110px_120px]"
                      >
                        <span className={`col-start-1 row-start-1 sm:col-start-auto sm:row-start-auto ${d.environment === 'production' ? 'text-production' : 'text-staging'}`} title={d.environment === 'production' ? 'Produção' : 'Staging'}>
                          <EnvMark env={d.environment} />
                          <span className="sr-only">{d.environment === 'production' ? 'Produção' : 'Staging'}</span>
                        </span>
                        <span className="col-start-2 row-start-1 min-w-0 sm:col-start-auto sm:row-start-auto">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="code truncate font-medium">{d.code_version}</span>
                            {d.metadata_pr_count > 0 && <MetadataBadge count={d.metadata_pr_count} />}
                          </span>
                          <span className="code block truncate text-sm text-muted">{d.branch ?? '—'}</span>
                        </span>
                        <span className="col-start-2 row-start-2 min-w-0 truncate text-sm text-ink-2 sm:col-start-auto sm:row-start-auto">{d.project_name}{d.sprint ? `, sprint ${d.sprint}` : ''}</span>
                        <span className="col-start-3 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto sm:justify-self-start"><TypeBadge type={d.type} /></span>
                        <span className="col-start-3 row-start-2 justify-self-end text-sm text-muted sm:col-start-auto sm:row-start-auto">
                          {plural(d.tasks.length, 'task', 'tasks')}, {d.pull_requests.length} PR
                        </span>
                      </Link>
                      <CardRefs deploy={d} />
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
        </DeployRefsToggle>
      )}
    </>
  )
}
