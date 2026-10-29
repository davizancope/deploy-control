'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { env } from '@/lib/env'
import { fieldErrorsFrom, type FormState } from '@/lib/forms'
import { hasDigit, hasLetter, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/password-rules'
import { safeNext } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

type AuthErr = { status?: number; code?: string; message: string }

/**
 * Registra o erro do Supabase Auth no terminal e, fora de produção, devolve o detalhe técnico para a tela.
 * @param where Nome da ação, para identificar no log.
 * @param error Erro devolvido pelo Supabase.
 * @returns Sufixo com código e mensagem (vazio em produção).
 */
function logAuthError(where: string, error: AuthErr): string {
  console.error(`[auth:${where}]`, error.status, error.code, error.message)
  return process.env.NODE_ENV === 'production' ? '' : ` Detalhe: ${error.code ?? error.status ?? 'sem código'}: ${error.message}`
}

/**
 * Traduz os erros de configuração mais comuns (chave errada, e-mail que não sai).
 * @param error Erro devolvido pelo Supabase.
 * @returns Mensagem específica ou null se for outro tipo de erro.
 */
function configError(error: AuthErr): string | null {
  if (error.status === 401 || /invalid api key|no api key/i.test(error.message))
    return 'A chave do Supabase no .env.local está errada ou vazia. Confira a NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e reinicie o npm run dev.'
  if (/sending.*(confirmation|recovery|email)/i.test(error.message) || error.code === 'email_address_not_authorized')
    return 'O Supabase não conseguiu enviar o e-mail. Sem SMTP próprio, ele só envia para membros do time do projeto no Supabase.'
  if (error.code === 'email_address_invalid') return 'Esse e-mail não foi aceito pelo Supabase. Use outro endereço.'
  if (error.code === 'signup_disabled' || error.code === 'email_provider_disabled')
    return 'Cadastro por e-mail está desligado no Supabase (Authentication → Sign In / Providers → Email).'
  return null
}

const email = z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254)
const password = z
  .string()
  .min(PASSWORD_MIN, `Use pelo menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `Use no máximo ${PASSWORD_MAX} caracteres.`)
  .refine((p) => hasLetter(p) && hasDigit(p), 'Misture letras e números.')

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, 'Informe a senha.').max(PASSWORD_MAX) })
    .safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.code === 'email_not_confirmed')
      return { error: 'Confirme seu e-mail pelo link que enviamos antes de entrar.' }
    if (error.status === 429) return { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
    const detail = logAuthError('signIn', error)
    if (error.code === 'invalid_credentials') return { error: 'E-mail ou senha incorretos.' }
    return { error: (configError(error) ?? 'Não foi possível entrar.') + detail }
  }
  redirect(safeNext(formData.get('next')))
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, 'Informe seu nome.').max(120),
      email,
      password,
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem.' })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.siteUrl()}/auth/callback?next=/onboarding`,
      data: { full_name: parsed.data.full_name },
    },
  })
  if (error) {
    if (error.code === 'weak_password') return { fieldErrors: { password: 'Senha fraca ou já vazada. Escolha outra.' } }
    if (error.status === 429) return { error: 'Muitos cadastros ou e-mails em pouco tempo. Tente de novo em alguns minutos.' }
    const detail = logAuthError('signUp', error)
    return { error: (configError(error) ?? 'Não foi possível criar a conta.') + detail }
  }
  if (data.session) redirect('/onboarding')
  // Mesma mensagem para e-mail novo ou já cadastrado, para não revelar quem tem conta.
  return { message: `Se o e-mail estiver livre, enviamos um link de confirmação para ${parsed.data.email}.` }
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl()}/auth/callback?next=/auth/nova-senha`,
  })
  if (error?.status === 429) return { error: 'Muitas tentativas. Espere alguns minutos.' }
  if (error) {
    const config = configError(error)
    const detail = logAuthError('resetPassword', error)
    if (config) return { error: config + detail }
  }
  return { message: 'Se houver uma conta com esse e-mail, você vai receber o link para criar uma nova senha.' }
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem.' })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return { error: 'O link expirou. Peça um novo em "Esqueci a senha".' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (error.code === 'same_password') return { fieldErrors: { password: 'Escolha uma senha diferente da atual.' } }
    if (error.code === 'weak_password') return { fieldErrors: { password: 'Senha fraca ou já vazada. Escolha outra.' } }
    return { error: 'Não foi possível trocar a senha. Tente de novo.' + logAuthError('updatePassword', error) }
  }
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
