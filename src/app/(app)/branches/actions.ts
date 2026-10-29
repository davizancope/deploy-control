'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { fieldErrorsFrom, type FormState } from '@/lib/forms'
import { requireContext } from '@/lib/session'

const schema = z.object({
  project_id: z.uuid(),
  branch: z.string().trim().min(1, 'Informe a branch.').max(200),
  target_branch: z.string().trim().min(1, 'Informe a branch de destino.').max(200, 'Use no máximo 200 caracteres.'),
  merged_on: z.iso.date('Informe a data do merge.'),
})

/**
 * Registra (ou corrige a data de) o merge de uma branch na master ou em outro destino.
 * @param _prev Estado anterior do formulário.
 * @param formData Campos project_id, branch, target_branch e merged_on.
 * @returns Mensagem de sucesso ou erros por campo.
 */
export async function saveBranchMerge(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext()
  if (!ctx.canWrite) return { error: 'Seu perfil só lê os dados.' }
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }
  const { error } = await ctx.supabase
    .from('branch_merges')
    .upsert({ ...parsed.data, org_id: ctx.org.id }, { onConflict: 'project_id,branch,target_branch' })
  if (error) return { error: `Não foi possível salvar: ${error.message}` }
  revalidatePath('/branches')
  return { message: `Merge em ${parsed.data.target_branch} registrado.` }
}

/**
 * Desfaz o registro de um merge.
 * @param formData Campo id do merge.
 */
export async function deleteBranchMerge(formData: FormData) {
  const ctx = await requireContext()
  const id = z.uuid().safeParse(formData.get('id'))
  if (!ctx.canWrite || !id.success) return
  await ctx.supabase.from('branch_merges').delete().eq('org_id', ctx.org.id).eq('id', id.data)
  revalidatePath('/branches')
}
