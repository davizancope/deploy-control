'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fieldErrorsFrom, type FormState } from '@/lib/forms'
import { getCurrentUser, ORG_COOKIE } from '@/lib/session'

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsed = z
    .object({ name: z.string().trim().min(2, 'Use pelo menos 2 caracteres.').max(80, 'Use no máximo 80 caracteres.') })
    .safeParse({ name: formData.get('name') })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const { data, error } = await user.supabase.rpc('create_organization', { p_name: parsed.data.name })
  if (error) return { error: error.code === '54000' ? error.message : 'Não foi possível criar a organização.' }

  ;(await cookies()).set(ORG_COOKIE, String(data), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/projetos?novo=1')
}
