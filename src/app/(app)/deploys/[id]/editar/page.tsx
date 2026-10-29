import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getDeploy, knownLinksByProject, latestVersionByProject, listProjects } from '@/lib/data'
import { requireContext } from '@/lib/session'
import { DeployForm } from '../../deploy-form'
import { valuesFromDeploy } from '../../form-values'

export const metadata: Metadata = { title: 'Editar deploy' }

export default async function EditDeployPage({ params }: PageProps<'/deploys/[id]/editar'>) {
  const ctx = await requireContext()
  const { id } = await params
  if (!ctx.canWrite) redirect(`/deploys/${id}`)
  const [deploy, projects, latest, known] = await Promise.all([getDeploy(ctx, id), listProjects(ctx, true), latestVersionByProject(ctx), knownLinksByProject(ctx)])
  if (!deploy) notFound()
  const choices = projects.filter((p) => !p.archived || p.id === deploy.project_id)

  return (
    <div className="max-w-4xl">
      <h1 className="mb-8 text-[28px] font-semibold tracking-tight">
        Editar <span className="code">{deploy.code_version}</span>
      </h1>
      <DeployForm values={valuesFromDeploy(deploy)} projects={choices} latest={latest} known={known} cancelHref={`/deploys/${deploy.id}`} />
    </div>
  )
}
