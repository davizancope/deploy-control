'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { fieldErrorsFrom, type FormState } from '@/lib/forms'
import { requireContext } from '@/lib/session'

const schema = z.object({
  body: z
    .string()
    .transform((v) => v.replace(/\r\n?/g, '\n').trim())
    .pipe(z.string().min(1, 'Escreva a mensagem.').max(4000, 'Use no máximo 4000 caracteres.')),
})

/**
 * Salva o modelo da mensagem ao time da organização ativa.
 * @param _prev Estado anterior do formulário (não usado).
 * @param formData Dados do formulário, com o campo body.
 * @returns Estado com erro, erros de campo ou confirmação.
 */
export async function saveMessageTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext()
  if (!ctx.canManage) return { error: 'Só donos e admins editam a mensagem.' }
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const { error } = await ctx.supabase
    .from('deploy_message_templates')
    .upsert({ org_id: ctx.org.id, body: parsed.data.body, updated_by: ctx.user.id }, { onConflict: 'org_id' })
  if (error) return { error: `Não foi possível salvar: ${error.message}` }
  revalidatePath('/', 'layout')
  return { message: 'Mensagem salva.' }
}
