'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FormState } from '@/lib/forms'
import { extractTokens } from '@/lib/parse/tokens'
import { requireContext } from '@/lib/session'

export async function linkRef(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext()
  if (!ctx.canWrite) return { error: 'Seu acesso nesta organização é só de leitura.' }

  const parsed = z
    .object({
      kind: z.enum(['pr', 'commit']),
      id: z.uuid(),
      other: z.string().max(1000).default(''),
      no_task: z.string().optional(),
      description: z.string().trim().max(300).default(''),
    })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Dados inválidos. Recarregue a página.' }
  const f = parsed.data

  const checked = formData.getAll('tasks').map(String).filter((t) => /^[A-Z][A-Z0-9]{1,19}-\d{1,7}$/.test(t))
  const { data: item } = await ctx.supabase
    .from(f.kind === 'pr' ? 'pull_requests' : 'commits')
    .select('projects(jira_project_prefix)')
    .eq('org_id', ctx.org.id)
    .eq('id', f.id)
    .maybeSingle()
  const jiraPrefix = (item as unknown as { projects: { jira_project_prefix: string | null } | null } | null)?.projects?.jira_project_prefix ?? null

  const other = extractTokens(f.other.replace(/[,;\s]+/g, '\n'), { jiraPrefix })
  if (other.notes.length) return { error: `Task "${other.notes[0]}" não reconhecida. Use ${jiraPrefix ? `o número (${jiraPrefix}-123 vira 123), a chave` : 'a chave (ABC-123)'} ou o link do Jira.` }
  const tasks = [...new Set([...checked, ...other.tasks])].slice(0, 50)
  const noTask = f.no_task === 'on'

  if (!tasks.length && !noTask) return { error: 'Marque pelo menos uma task ou "Sem task".' }
  if (!tasks.length && noTask && !f.description) return { error: 'Sem task, descreva o que mudou.' }

  const fn = f.kind === 'pr' ? 'link_pull_request' : 'link_commit'
  const { error } = await ctx.supabase.rpc(fn, { p_id: f.id, p_tasks: tasks, p_no_task: noTask, p_description: f.description || null })
  if (error) return { error: `Não foi possível salvar: ${error.message}` }

  revalidatePath('/', 'layout')
  return { message: tasks.length ? `Ligado a ${tasks.join(', ')}.` : 'Marcado como sem task.' }
}
