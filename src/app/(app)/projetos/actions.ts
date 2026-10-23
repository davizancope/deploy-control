'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { fieldErrorsFrom, type FormState } from '@/lib/forms'
import { requireContext } from '@/lib/session'

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => v.replace(/\/+$/, ''))
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), 'Use um endereço começando com https://')
  .transform((v) => (v === '' ? null : v))

const jiraPrefix = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === '' || /^[A-Z][A-Z0-9]{1,19}$/.test(v), 'Use letras e números, começando por letra (ex.: SUZSFCCSUS).')
  .transform((v) => (v === '' ? null : v))

const schema = z.object({
  id: z.union([z.literal(''), z.uuid()]),
  name: z.string().trim().min(1, 'Informe o nome.').max(80, 'Use no máximo 80 caracteres.'),
  jira_base_url: httpsUrl,
  jira_project_prefix: jiraPrefix,
  repo_url: httpsUrl,
})

export async function saveProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext()
  if (!ctx.canManage) return { error: 'Só donos e admins cadastram projetos.' }
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }
  const { id, ...fields } = parsed.data

  const { error } = id
    ? await ctx.supabase.from('projects').update(fields).eq('org_id', ctx.org.id).eq('id', id)
    : await ctx.supabase.from('projects').insert({ ...fields, org_id: ctx.org.id })
  if (error) {
    if (error.code === '23505') return { fieldErrors: { name: 'Já existe um projeto com esse nome.' } }
    return { error: `Não foi possível salvar: ${error.message}` }
  }
  revalidatePath('/', 'layout')
  return { message: id ? 'Projeto atualizado.' : `Projeto ${fields.name} criado.` }
}

export async function toggleArchive(formData: FormData) {
  const ctx = await requireContext()
  const id = z.uuid().safeParse(formData.get('id'))
  if (!ctx.canManage || !id.success) return
  const archived = formData.get('archived') === 'true'
  await ctx.supabase.from('projects').update({ archived: !archived }).eq('org_id', ctx.org.id).eq('id', id.data)
  revalidatePath('/', 'layout')
}
