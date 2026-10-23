'use client'

import Link from 'next/link'
import { FieldError, FormNotice, SubmitButton } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { requestPasswordReset, signIn, signUp, updatePassword } from './actions'

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const { state, onSubmit, pending } = useFormAction(signIn)
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormNotice error={state.error ?? notice} />
      <input type="hidden" name="next" value={next ?? '/'} />
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">Senha</label>
          <Link href="/recuperar-senha" className="text-sm text-ink-2 underline-offset-4 hover:underline">
            Esqueci a senha
          </Link>
        </div>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <SubmitButton busy={pending} pending="Entrando…" className="btn-primary w-full">Entrar</SubmitButton>
    </form>
  )
}

export function SignUpForm() {
  const { state, onSubmit, pending } = useFormAction(signUp)
  if (state.message) return <FormNotice message={state.message} />
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormNotice error={state.error} />
      <div>
        <label className="label" htmlFor="full_name">Nome</label>
        <input className="field" id="full_name" name="full_name" autoComplete="name" required />
        <FieldError message={state.fieldErrors?.full_name} />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail de trabalho</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input className="field" id="password" name="password" type="password" autoComplete="new-password" required aria-describedby="password-hint" />
        <p id="password-hint" className="mt-1.5 text-sm text-muted">Pelo menos 10 caracteres, com letras e números.</p>
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repita a senha</label>
        <input className="field" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.confirm} />
      </div>
      <SubmitButton busy={pending} pending="Criando conta…" className="btn-primary w-full">Criar conta</SubmitButton>
    </form>
  )
}

export function ResetRequestForm() {
  const { state, onSubmit, pending } = useFormAction(requestPasswordReset)
  if (state.message) return <FormNotice message={state.message} />
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormNotice error={state.error} />
      <div>
        <label className="label" htmlFor="email">E-mail da conta</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <SubmitButton busy={pending} pending="Enviando…" className="btn-primary w-full">Enviar link</SubmitButton>
    </form>
  )
}

export function NewPasswordForm() {
  const { state, onSubmit, pending } = useFormAction(updatePassword)
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormNotice error={state.error} />
      <div>
        <label className="label" htmlFor="password">Nova senha</label>
        <input className="field" id="password" name="password" type="password" autoComplete="new-password" required />
        <p className="mt-1.5 text-sm text-muted">Pelo menos 10 caracteres, com letras e números.</p>
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repita a nova senha</label>
        <input className="field" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.confirm} />
      </div>
      <SubmitButton busy={pending} pending="Salvando…" className="btn-primary w-full">Salvar nova senha</SubmitButton>
    </form>
  )
}
