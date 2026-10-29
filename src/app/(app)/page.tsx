import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchAllPages, listProjects, projectIdsFilter } from '@/lib/data'
import { addDays } from '@/lib/format'
import { computeInsights, type DashDeploy, type DashPr, type DashTask } from '@/lib/insights'
import { todayIso } from '@/lib/parse/dates'
import { requireContext } from '@/lib/session'
import { DashboardView } from './dashboard-view'

export const metadata: Metadata = { title: 'Painel' }

const PERIODS = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '6 meses' },
]

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const ctx = await requireContext()
  const sp = await searchParams
  const period = PERIODS.some((p) => p.value === sp.periodo) ? String(sp.periodo) : '90'
  const projects = await listProjects(ctx)
  const scope = projectIdsFilter(projects)
  const projectId = typeof sp.projeto === 'string' && projects.some((p) => p.id === sp.projeto) ? sp.projeto : ''
  const to = todayIso()
  const from = addDays(to, -Number(period) + 1)

  const deployQuery = () => {
    const q = ctx.supabase
      .from('deployments')
      .select('id, project_id, code_version, environment, type, deployed_on, projects(name)')
      .eq('org_id', ctx.org.id)
      .gte('deployed_on', from)
      .lte('deployed_on', to)
    return projectId ? q.eq('project_id', projectId) : q.in('project_id', scope)
  }
  const taskQuery = () => {
    const q = ctx.supabase
      .from('task_deploy_summary')
      .select('task_key, project_id, first_staging_on, first_production_on, staging_deploys, production_deploys, last_deployed_on')
      .eq('org_id', ctx.org.id)
      .gte('last_deployed_on', addDays(from, -365))
    return projectId ? q.eq('project_id', projectId) : q.in('project_id', scope)
  }
  const prQuery = () => {
    const q = ctx.supabase
      .from('pull_request_summary')
      .select('id, project_id, url, number, description, link_status, first_staging_on, first_production_on, last_deployed_on')
      .eq('org_id', ctx.org.id)
      .gte('last_deployed_on', addDays(from, -365))
    return projectId ? q.eq('project_id', projectId) : q.in('project_id', scope)
  }
  const [deployRows, taskRows, prRows, { count: totalDeploys }] = await Promise.all([
    fetchAllPages((a, b) => deployQuery().order('deployed_on').order('id').range(a, b)),
    fetchAllPages((a, b) => taskQuery().order('task_key').order('project_id').range(a, b)),
    fetchAllPages((a, b) => prQuery().order('id').range(a, b)),
    ctx.supabase.from('deployments').select('id', { count: 'exact', head: true }).eq('org_id', ctx.org.id).in('project_id', scope),
  ])

  if (!totalDeploys) return <EmptyDashboard canWrite={ctx.canWrite} orgName={ctx.org.name} />

  const deploys: DashDeploy[] = (deployRows as unknown as Array<Omit<DashDeploy, 'project_name'> & { projects: { name: string } | null }>).map(
    ({ projects: p, ...d }) => ({ ...d, project_name: p?.name ?? '—' }),
  )
  const ins = computeInsights(deploys, taskRows as DashTask[], from, to, prRows as DashPr[])
  return (
    <DashboardView
      ins={ins}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      projectId={projectId}
      period={period}
      periods={PERIODS}
      from={from}
      to={to}
    />
  )
}

function EmptyDashboard({ canWrite, orgName }: { canWrite: boolean; orgName: string }) {
  return (
    <div className="max-w-2xl py-6">
      <h1 className="mb-2 text-[28px] font-semibold tracking-tight">{orgName} ainda não tem deploys</h1>
      <p className="mb-8 text-ink-2">
        O painel mostra o ritmo de releases por projeto, quanto tempo as tasks levam de staging até produção e onde está o retrabalho.
        Para começar, traga o histórico da planilha ou registre o próximo deploy.
      </p>
      <div className="flex flex-wrap gap-3">
        {canWrite && <Link href="/importar" className="btn-primary">Importar a planilha</Link>}
        {canWrite && <Link href="/deploys/novo" className="btn-quiet">Registrar deploy</Link>}
      </div>
    </div>
  )
}
