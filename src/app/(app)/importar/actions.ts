'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fetchAllPages, listProjects } from '@/lib/data'
import { importPayloadSchema, type DeployRow } from '@/lib/deploy-schema'
import { normalizeKey, parseSheet, type ParsedSheet } from '@/lib/parse/sheet'
import { readWorkbook } from '@/lib/parse/workbook'
import { requireContext } from '@/lib/session'

const MAX_BYTES = 5 * 1024 * 1024

export type PreviewSheet = Omit<ParsedSheet, 'deploys'> & {
  deploys: Array<DeployRow & { sourceRow: number; warnings: string[] }>
  suggestedTarget: string
}

export type PreviewState = {
  error?: string
  fileName?: string
  sheets?: PreviewSheet[]
}

export async function previewImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const ctx = await requireContext()
  if (!ctx.canWrite) return { error: 'Seu acesso nesta organização é só de leitura.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Escolha o arquivo da planilha.' }
  if (file.size > MAX_BYTES) return { error: 'O arquivo passa de 5 MB. Remova abas que não são de deploy e tente de novo.' }
  if (!/\.(xlsx|csv)$/i.test(file.name)) return { error: 'Use um arquivo .xlsx ou .csv.' }

  let sheets
  try {
    sheets = await readWorkbook(file.name, await file.arrayBuffer())
  } catch {
    return { error: 'Não consegui ler o arquivo. No Google Sheets, use Arquivo > Fazer download > Microsoft Excel (.xlsx).' }
  }

  const projects = await listProjects(ctx, true)
  const byName = new Map(projects.map((p) => [normalizeKey(p.name), p.id]))
  const parsed = sheets.map((s) => parseSheet(s.name, s.rows))
  if (parsed.every((p) => p.error || p.deploys.length === 0)) {
    return { error: 'Nenhuma aba com deploys reconhecíveis. A planilha precisa de uma coluna "Code Version" no cabeçalho.' }
  }

  return {
    fileName: file.name.slice(0, 200),
    sheets: parsed.map((p) => ({
      ...p,
      suggestedTarget: byName.get(normalizeKey(p.sheetName)) ?? (ctx.canManage && !p.error && p.deploys.length ? 'new' : 'skip'),
    })),
  }
}

export type CommitState = { error?: string }

export async function commitImport(_prev: CommitState, formData: FormData): Promise<CommitState> {
  const ctx = await requireContext()
  if (!ctx.canWrite) return { error: 'Seu acesso nesta organização é só de leitura.' }

  let json: unknown
  try {
    json = JSON.parse(String(formData.get('payload') ?? ''))
  } catch {
    return { error: 'Dados da importação inválidos. Envie o arquivo de novo.' }
  }
  const parsed = importPayloadSchema.safeParse(json)
  if (!parsed.success) return { error: 'Dados da importação inválidos. Envie o arquivo de novo.' }
  const { fileName, sheets } = parsed.data

  const projects = await listProjects(ctx, true)
  const rows: Array<DeployRow & { project_id: string; link_mode: 'merge' }> = []
  let skippedDuplicates = 0

  for (const sheet of sheets) {
    let projectId = sheet.target
    if (projectId === 'new') {
      if (!ctx.canManage) return { error: 'Só donos e admins criam projetos. Escolha um projeto existente.' }
      const existing = projects.find((p) => normalizeKey(p.name) === normalizeKey(sheet.name))
      if (existing) {
        projectId = existing.id
      } else {
        const { data, error } = await ctx.supabase
          .from('projects')
          .insert({ org_id: ctx.org.id, name: sheet.name, jira_base_url: sheet.jiraBaseUrl, repo_url: sheet.repoUrl })
          .select('id')
          .single()
        if (error) return { error: `Não consegui criar o projeto ${sheet.name}: ${error.message}` }
        projectId = data.id as string
      }
    } else if (!projects.some((p) => p.id === projectId)) {
      return { error: `Projeto escolhido para a aba ${sheet.name} não existe mais.` }
    }

    // Evita duplicar o que já foi importado ou registrado antes.
    const pid = projectId
    const existing = await fetchAllPages((a, b) =>
      ctx.supabase
        .from('deployments')
        .select('code_version, environment, deployed_on')
        .eq('org_id', ctx.org.id)
        .eq('project_id', pid)
        .order('id')
        .range(a, b),
    )
    const seen = new Set(existing.map((d) => `${d.code_version}|${d.environment}|${d.deployed_on}`))
    for (const d of sheet.deploys) {
      const key = `${d.code_version}|${d.environment}|${d.deployed_on}`
      if (seen.has(key)) {
        skippedDuplicates++
        continue
      }
      seen.add(key)
      rows.push({ ...d, project_id: projectId, link_mode: 'merge' })
    }
  }

  if (rows.length === 0) {
    return { error: skippedDuplicates ? 'Todos esses deploys já estavam registrados. Nada novo para importar.' : 'Nenhuma linha para importar.' }
  }

  const { error } = await ctx.supabase.rpc('import_deployments', { p_org: ctx.org.id, p_file_name: fileName, p_rows: rows })
  if (error) return { error: `A importação falhou e nada foi gravado: ${error.message}` }

  revalidatePath('/', 'layout')
  redirect(`/importar?ok=${rows.length}&dup=${skippedDuplicates}`)
}

export async function undoImport(formData: FormData) {
  const ctx = await requireContext()
  const id = z.uuid().safeParse(formData.get('id'))
  if (!ctx.canWrite || !id.success) return
  await ctx.supabase.from('import_batches').delete().eq('org_id', ctx.org.id).eq('id', id.data)
  revalidatePath('/', 'layout')
  redirect('/importar?desfeito=1')
}
