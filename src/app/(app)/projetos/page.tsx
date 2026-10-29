import type { Metadata } from 'next'
import Link from 'next/link'
import { listProjects, type Project } from '@/lib/data'
import { formatDate, plural } from '@/lib/format'
import { requireContext } from '@/lib/session'
import { toggleArchive } from './actions'
import { Flash } from '@/components/flash'
import { DeleteProjectForm } from './delete-project-form'
import { ProjectForm } from './project-form'

export const metadata: Metadata = { title: 'Projetos' }

type Stats = { project_id: string; deploys: number; production_deploys: number; last_deployed_on: string | null }

export default async function ProjectsPage({ searchParams }: PageProps<'/projetos'>) {
  const ctx = await requireContext()
  const sp = await searchParams
  const [projects, { data: statsRows }] = await Promise.all([
    listProjects(ctx, true),
    ctx.supabase.from('project_deploy_stats').select('project_id, deploys, production_deploys, last_deployed_on').eq('org_id', ctx.org.id),
  ])
  const stats = new Map(((statsRows ?? []) as Stats[]).map((s) => [s.project_id, s]))
  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Projetos</h1>
        <p className="text-ink-2">Cada cliente ou loja que recebe deploys.</p>
      </header>

      {typeof sp.excluido === 'string' && (
        <Flash className="mb-6 glass rounded-2xl px-4 py-2.5" clearParam="excluido">Projeto {sp.excluido} excluído.</Flash>
      )}

      {sp.novo && (
        <div className="mb-8 rounded-2xl border border-production/30 bg-production-soft px-5 py-4">
          <p className="font-semibold">Organização criada.</p>
          <p className="text-ink-2">
            Cadastre os projetos aqui ou <Link href="/importar" className="link">importe a planilha</Link>: cada aba vira um projeto.
          </p>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="lista">
          <h2 id="lista" className="sr-only">Lista de projetos</h2>
          {projects.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-ink-2">Nenhum projeto ainda.</p>
          ) : (
            <div className="space-y-8">
              {active.length > 0 && <ProjectList projects={active} stats={stats} canManage={ctx.canManage} />}
              {archived.length > 0 && (
                <div>
                  <h3 className="mb-1 text-lg font-semibold">Arquivados</h3>
                  <p className="mb-3 text-sm text-ink-2">Ficam fora dos filtros, do painel e do registro de deploys. Reative para voltar a usar.</p>
                  <ProjectList projects={archived} stats={stats} canManage={ctx.canManage} />
                </div>
              )}
            </div>
          )}
        </section>

        {ctx.canManage && (
          <section aria-labelledby="novo" className="h-fit glass rounded-2xl p-5">
            <h2 id="novo" className="mb-4 text-lg font-semibold">Novo projeto</h2>
            <ProjectForm submitLabel="Criar projeto" />
          </section>
        )}
      </div>
    </>
  )
}

function ProjectList({ projects, stats, canManage }: { projects: Project[]; stats: Map<string, Stats>; canManage: boolean }) {
  return (
    <ul className="divide-y divide-line glass rounded-2xl">
      {projects.map((p) => {
        const s = stats.get(p.id)
        return (
          <li key={p.id} className="px-5 py-4">
            <div className={`flex flex-wrap items-baseline justify-between gap-2 ${p.archived ? 'opacity-60' : ''}`}>
              {p.archived ? (
                <span className="text-lg font-semibold">{p.name}</span>
              ) : (
                <Link href={`/deploys?projeto=${p.id}`} className="text-lg font-semibold hover:underline">{p.name}</Link>
              )}
              <span className="text-sm text-ink-2">
                {s?.deploys ? `${plural(s.deploys, 'deploy', 'deploys')}, ${s.production_deploys} em produção` : 'Sem deploys'}
                {s?.last_deployed_on ? `. Último em ${formatDate(s.last_deployed_on)}` : ''}
              </span>
            </div>
            <div className={p.archived ? 'opacity-60' : ''}>
              <p className="code mt-1 truncate text-sm text-muted">{p.repo_url ?? 'Repositório não informado'}</p>
              {p.jira_project_prefix && <p className="code mt-0.5 text-sm text-muted">Jira: {p.jira_project_prefix}-123</p>}
            </div>
            {canManage && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-ink-2 hover:text-ink">Editar</summary>
                <div className="mt-4 max-w-md space-y-4">
                  <ProjectForm values={p} submitLabel="Salvar projeto" />
                  <form action={toggleArchive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="archived" value={String(p.archived)} />
                    <button type="submit" className="link text-sm">{p.archived ? 'Reativar projeto' : 'Arquivar projeto'}</button>
                  </form>
                  <DeleteProjectForm id={p.id} name={p.name} deploys={s?.deploys ?? 0} />
                </div>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
