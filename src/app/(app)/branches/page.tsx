import type { Metadata } from 'next'
import Link from 'next/link'
import { AutoSubmitSelect } from '@/components/auto-submit-select'
import { BranchMap } from '@/components/charts/branch-map'
import { Icon } from '@/components/icons'
import { EnvMark, TypeBadge, TypeMark } from '@/components/ui'
import { buildBranchGraph, layoutBranchGraph, type BranchDeploy, type BranchGraph, type BranchMerge, type BranchNode } from '@/lib/branch-graph'
import { fetchAllPages, listProjects } from '@/lib/data'
import { addDays, formatDate, plural } from '@/lib/format'
import { todayIso } from '@/lib/parse/dates'
import { requireContext } from '@/lib/session'
import { deleteBranchMerge } from './actions'
import { MergeForm } from './merge-form'

export const metadata: Metadata = { title: 'Branches' }

const PERIODS = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '6 meses' },
  { value: 'all', label: 'Tudo' },
]

export default async function BranchesPage({ searchParams }: PageProps<'/branches'>) {
  const ctx = await requireContext()
  const sp = await searchParams
  const projects = await listProjects(ctx)
  if (projects.length === 0) {
    return (
      <>
        <h1 className="mb-6 text-[28px] font-semibold tracking-tight">Branches</h1>
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-ink-2">
          Cadastre um projeto para ver como as branches se ligam. <Link href="/projetos" className="link">Ir para projetos</Link>
        </p>
      </>
    )
  }
  const project = projects.find((p) => p.id === sp.projeto) ?? projects[0]
  const period = PERIODS.some((p) => p.value === sp.periodo) ? String(sp.periodo) : '90'
  const pending = sp.pendentes === '1'
  const selected = typeof sp.branch === 'string' ? sp.branch : ''
  const from = period === 'all' ? null : addDays(todayIso(), -Number(period) + 1)

  const rows = await fetchAllPages((a, b) => {
    let q = ctx.supabase
      .from('deployments')
      .select('id, code_version, branch, source_branch, merged_branches, environment, type, deployed_on')
      .eq('org_id', ctx.org.id)
      .eq('project_id', project.id)
    if (from) q = q.gte('deployed_on', from)
    return q.order('deployed_on').order('id').range(a, b)
  })
  const mergeRows = await fetchAllPages((a, b) =>
    ctx.supabase
      .from('branch_merges')
      .select('id, branch, target_branch, merged_on')
      .eq('org_id', ctx.org.id)
      .eq('project_id', project.id)
      .order('id')
      .range(a, b),
  )
  const graph = buildBranchGraph(rows as unknown as BranchDeploy[], mergeRows as unknown as BranchMerge[])
  const layout = layoutBranchGraph(graph)
  const node = selected ? graph.nodes.get(selected) : undefined

  const hrefFor = (branch: string) => {
    const q = new URLSearchParams({ projeto: project.id, periodo: period, branch })
    if (pending) q.set('pendentes', '1')
    return `/branches?${q}`
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Branches</h1>
          <p className="max-w-[60ch] text-ink-2">
            De onde cada branch nasceu e o que entrou nela em {project.name}. Clique numa branch para ver o ciclo de vida.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <label htmlFor="projeto" className="sr-only">Projeto</label>
          <AutoSubmitSelect id="projeto" name="projeto" defaultValue={project.id} className="field w-auto py-1.5">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </AutoSubmitSelect>
          <fieldset className="flex rounded-full border border-line-strong bg-sunken p-0.5">
            <legend className="sr-only">Período</legend>
            {PERIODS.map((p) => (
              <label key={p.value}>
                <input type="radio" name="periodo" value={p.value} defaultChecked={p.value === period} className="peer sr-only" />
                <span className="block cursor-pointer rounded-full px-3.5 py-1 text-sm text-ink-2 peer-checked:lift peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]">{p.label}</span>
              </label>
            ))}
          </fieldset>
          <label>
            <input type="checkbox" name="pendentes" value="1" defaultChecked={pending} className="peer sr-only" />
            <span className="block cursor-pointer rounded-full border border-line-strong bg-sunken px-3.5 py-1.5 text-sm text-ink-2 peer-checked:lift peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]">Só o que falta subir</span>
          </label>
          <button type="submit" className="btn-quiet py-1.5 text-sm">Aplicar</button>
        </form>
      </header>

      {graph.nodes.size === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-ink-2">
          Nenhum deploy com branch neste período. Preencha a branch no registro do deploy para ela aparecer aqui.
        </p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="glass min-w-0 rounded-2xl" aria-label="Mapa de branches">
            <Legend />
            {layout.nodes.length > 0 ? (
              <BranchMap layout={layout} selected={selected} dimProduction={pending} hrefFor={hrefFor} />
            ) : (
              <p className="px-5 py-8 text-ink-2">Nenhuma branch ligada a outra neste período. As que subiram sem origem estão na lista ao lado.</p>
            )}
          </section>
          <div className="space-y-6">
            {node && <BranchDetail graph={graph} node={node} hrefFor={hrefFor} projectId={project.id} canWrite={ctx.canWrite} today={todayIso()} />}
            <Orphans items={graph.orphans} hrefFor={hrefFor} selected={selected} />
          </div>
        </div>
      )}
    </>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-line px-5 py-3 text-sm text-ink-2">
      <span className="inline-flex items-center gap-2">
        <svg width="28" height="8" aria-hidden="true"><path d="M1 4h26" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        Criada a partir de
      </span>
      <span className="inline-flex items-center gap-2">
        <svg width="28" height="8" aria-hidden="true"><path d="M1 4h26" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 5" /></svg>
        Mesclada em
      </span>
      <span className="inline-flex items-center gap-2">
        <svg width="28" height="8" aria-hidden="true"><path d="M1 4h26" stroke="var(--production)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        Chegou na master
      </span>
      {(['release', 'bugfix', 'hotfix'] as const).map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5"><TypeMark type={t} size={15} />{t === 'release' ? 'Release' : t === 'bugfix' ? 'Bugfix' : 'Hotfix'}</span>
      ))}
    </div>
  )
}

function BranchDetail({
  graph,
  node,
  hrefFor,
  projectId,
  canWrite,
  today,
}: {
  graph: BranchGraph
  node: BranchNode
  hrefFor: (b: string) => string
  projectId: string
  canWrite: boolean
  today: string
}) {
  const rel = (pick: (e: BranchGraph['edges'][number]) => boolean, side: 'from' | 'to') => graph.edges.filter(pick).map((e) => e[side])
  const groups = [
    { title: 'Nasceu de', items: rel((e) => e.to === node.name && e.kind === 'origin', 'from') },
    { title: 'Recebeu merge de', items: rel((e) => e.to === node.name && e.kind === 'merge', 'from') },
    { title: 'Deu origem a', items: rel((e) => e.from === node.name && e.kind === 'origin', 'to') },
    { title: 'Foi mesclada em', items: rel((e) => e.from === node.name && e.kind === 'merge', 'to') },
  ].filter((g) => g.items.length > 0)
  const deploys = [...node.deploys].reverse()
  return (
    <section className="glass rounded-2xl p-5" aria-label={`Ciclo de vida de ${node.name}`}>
      <h2 className="code mb-1 font-semibold break-all">{node.name}</h2>
      <p className="mb-4 text-sm text-ink-2">
        {node.firstProductionOn
          ? `Em produção desde ${formatDate(node.firstProductionOn)}.`
          : node.deploys.length
            ? 'Ainda não foi para produção.'
            : 'Só foi citada como origem ou merge; sem deploy no período.'}
      </p>
      {groups.map((g) => (
        <div key={g.title} className="mb-4">
          <h3 className="mb-1.5 text-sm font-semibold">{g.title}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {g.items.map((b) => (
              <li key={b}><Link href={hrefFor(b)} className="code inline-block rounded-xl border border-line bg-lift px-2 py-0.5 text-sm hover:border-ink">{b}</Link></li>
            ))}
          </ul>
        </div>
      ))}
      {(node.merges.length > 0 || (canWrite && node.deploys.length > 0)) && (
        <div className="mb-4">
          <h3 className="mb-1.5 text-sm font-semibold">Na master</h3>
          {node.merges.length === 0 && <p className="mb-2 text-sm text-ink-2">Ainda não foi mesclada. Registre quando o merge acontecer.</p>}
          <ul className="mb-2 space-y-1.5">
            {node.merges.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className="text-production"><Icon name="merge" size={16} /></span>
                <span className="min-w-0 flex-1">
                  Mesclada em <span className="code">{m.target_branch}</span>, {formatDate(m.merged_on)}
                </span>
                {canWrite && (
                  <form action={deleteBranchMerge}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="link text-sm">Desfazer</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {canWrite && node.deploys.length > 0 && <MergeForm key={node.name} projectId={projectId} branch={node.name} today={today} />}
        </div>
      )}
      {deploys.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">{plural(deploys.length, 'deploy', 'deploys')}</h3>
          <ol className="divide-y divide-line">
            {deploys.map((d) => (
              <li key={d.id}>
                <Link href={`/deploys/${d.id}`} className="flex items-center gap-2.5 py-2 hover:bg-sunken">
                  <span className={d.environment === 'production' ? 'text-production' : 'text-staging'}><EnvMark env={d.environment} size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="code block truncate text-sm">{d.code_version}</span>
                    <span className="block text-xs text-muted">{formatDate(d.deployed_on)}</span>
                  </span>
                  <TypeBadge type={d.type} />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function Orphans({ items, hrefFor, selected }: { items: BranchNode[]; hrefFor: (b: string) => string; selected: string }) {
  return (
    <section className="glass rounded-2xl" aria-labelledby="sem-origem">
      <h2 id="sem-origem" className="border-b border-line px-5 py-3 font-semibold">Sem origem informada</h2>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-sm text-ink-2">Todas as branches que subiram têm ligação com outra.</p>
      ) : (
        <>
          <p className="px-5 pt-3 text-sm text-ink-2">Subiram sem “Criada a partir da” nem merge. Preencha no deploy para entrarem no mapa.</p>
          <ol className="divide-y divide-line">
            {items.slice(0, 30).map((n) => (
              <li key={n.name}>
                <Link href={hrefFor(n.name)} aria-current={n.name === selected ? 'true' : undefined} className="flex items-center gap-2.5 px-5 py-2.5 hover:bg-sunken aria-[current=true]:bg-sunken">
                  {n.type && <TypeMark type={n.type} size={16} />}
                  <span className="min-w-0 flex-1">
                    <span className="code block truncate text-sm">{n.name}</span>
                    <span className="block text-xs text-muted">
                      {plural(n.deploys.length, 'deploy', 'deploys')}, último em {formatDate(n.lastDeployedOn!, false)}
                      {n.merges.length > 0 && `, na ${n.merges[0].target_branch} desde ${formatDate(n.merges[0].merged_on, false)}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {items.length > 30 && <p className="border-t border-line px-5 py-2 text-sm text-muted">E mais {items.length - 30}.</p>}
        </>
      )}
    </section>
  )
}
