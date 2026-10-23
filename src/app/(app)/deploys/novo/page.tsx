import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDeploy, knownLinksByProject, latestVersionByProject, listProjects } from '@/lib/data'
import { todayIso } from '@/lib/parse/dates'
import { requireContext } from '@/lib/session'
import { DeployForm } from '../deploy-form'
import { emptyValues, valuesFromDeploy } from '../form-values'

export const metadata: Metadata = { title: 'Registrar deploy' }

export default async function NewDeployPage({ searchParams }: PageProps<'/deploys/novo'>) {
  const ctx = await requireContext()
  if (!ctx.canWrite) redirect('/deploys')
  const sp = await searchParams
  const [projects, latest, known] = await Promise.all([listProjects(ctx), latestVersionByProject(ctx), knownLinksByProject(ctx)])

  if (projects.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-[28px] font-semibold tracking-tight">Registrar deploy</h1>
        <p className="mb-6 text-ink-2">Antes do primeiro deploy, cadastre o projeto (cliente) a que ele pertence.</p>
        <Link href="/projetos" className="btn-primary">Cadastrar projeto</Link>
      </div>
    )
  }

  const base = typeof sp.de === 'string' ? await getDeploy(ctx, sp.de) : null
  const promote = Boolean(base) && sp.ambiente === 'production'
  const values = base
    ? { ...valuesFromDeploy(base), id: '', deployed_on: todayIso(), environment: promote ? ('production' as const) : base.environment }
    : emptyValues(typeof sp.projeto === 'string' ? sp.projeto : projects.length === 1 ? projects[0].id : '')

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-[28px] font-semibold tracking-tight">{promote ? 'Promover para Produção' : 'Registrar deploy'}</h1>
      <p className="mb-8 text-ink-2">
        {base
          ? <>Campos copiados de <span className="code">{base.code_version}</span>. Ajuste o code version e o que mudou.</>
          : 'Preencha logo depois de ativar a code version no Business Manager.'}
      </p>
      <DeployForm values={values} projects={projects} latest={latest} known={known} cancelHref={base ? `/deploys/${base.id}` : '/deploys'} />
    </div>
  )
}
