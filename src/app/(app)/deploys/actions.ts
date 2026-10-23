'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { listProjects } from '@/lib/data'
import { fieldErrorsFrom, type FormState } from '@/lib/forms'
import { parseChangeRows, type ChangeRow } from '@/lib/change-rows'
import { TASK_KEY_RE } from '@/lib/parse/tokens'
import { requireContext } from '@/lib/session'
import type { DeployInput } from '@/lib/types'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))

const schema = z.object({
  id: z.union([z.literal(''), z.uuid()]).transform((v) => (v === '' ? null : v)),
  project_id: z.uuid('Escolha o projeto.'),
  code_version: z.string().trim().min(1, 'Informe o code version.').max(120).regex(/^\S+$/, 'Code version não pode ter espaços.'),
  branch: optionalText(200),
  environment: z.enum(['staging', 'production'], 'Escolha o ambiente.'),
  deployed_on: z.iso.date('Informe a data do deploy.'),
  sprint: optionalText(60),
  type: z.enum(['release', 'hotfix', 'bugfix'], 'Escolha o tipo.'),
  source_branch: optionalText(200),
  merged_branches: z.string().max(5000),
  changes: z.string().max(200000),
  notes: optionalText(2000),
})

const rowsSchema = z
  .array(z.object({ ref: z.string().max(600), tasks: z.string().max(2000), description: z.string().max(600) }))
  .max(200)

export async function saveDeploy(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext()
  if (!ctx.canWrite) return { error: 'Seu acesso nesta organização é só de leitura.' }

  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }
  const f = parsed.data

  const projects = await listProjects(ctx, true)
  const project = projects.find((p) => p.id === f.project_id)
  if (!project) return { fieldErrors: { project_id: 'Projeto não encontrado.' } }

  const fieldErrors: Record<string, string> = {}
  let rows: ChangeRow[] = []
  try {
    const parsedRows = rowsSchema.safeParse(JSON.parse(f.changes || '[]'))
    if (parsedRows.success) rows = parsedRows.data
    else fieldErrors.changes = 'Linhas inválidas. Recarregue a página e tente de novo.'
  } catch {
    fieldErrors.changes = 'Linhas inválidas. Recarregue a página e tente de novo.'
  }
  const changes = parseChangeRows(rows, project.repo_url, project.jira_project_prefix)
  if (changes.errors.length) fieldErrors.changes = changes.errors.join('\n')

  const branches = f.merged_branches.split(/\r?\n/).map((b) => b.trim()).filter(Boolean)
  if (branches.some((b) => /\s/.test(b))) fieldErrors.merged_branches = 'Uma branch por linha, sem espaços.'
  if (branches.length > 50) fieldErrors.merged_branches = 'Máximo de 50 branches.'

  if (Object.keys(fieldErrors).length) return { fieldErrors }

  const branchKeys = branches.flatMap((b) => [...b.matchAll(TASK_KEY_RE)].map((m) => m[1]))
  const payload: DeployInput = {
    project_id: f.project_id,
    code_version: f.code_version,
    branch: f.branch,
    environment: f.environment,
    deployed_on: f.deployed_on,
    sprint: f.sprint,
    type: f.type,
    source_branch: f.source_branch,
    merged_branches: [...new Set(branches)],
    notes: f.notes,
    tasks: [...new Set([...changes.tasks, ...branchKeys])],
    pull_requests: changes.pullRequests,
    commits: changes.commits,
    link_mode: 'replace',
  }

  const { data, error } = await ctx.supabase.rpc('save_deployment', { p_org: ctx.org.id, p_id: f.id, p: payload })
  if (error) return { error: error.code === 'P0002' ? 'Esse deploy não existe mais.' : `Não foi possível salvar: ${error.message}` }

  revalidatePath('/', 'layout')
  redirect(`/deploys/${data}?salvo=1`)
}

export async function deleteDeploy(formData: FormData) {
  const ctx = await requireContext()
  const id = z.uuid().safeParse(formData.get('id'))
  if (!ctx.canWrite || !id.success) redirect('/deploys')
  await ctx.supabase.from('deployments').delete().eq('org_id', ctx.org.id).eq('id', id.data)
  revalidatePath('/', 'layout')
  redirect('/deploys?removido=1')
}
