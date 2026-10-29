'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PasswordField, RuleChecklist } from '@/components/password-field'
import { FieldError, FormNotice, SubmitButton } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { evaluatePassword } from '@/lib/password-rules'
import { requestPasswordReset, signIn, signUp, updatePassword } from './actions'

/**
 * Critério de confirmação da senha, exibido assim que a pessoa começa a repetir.
 * @param password Senha digitada no primeiro campo.
 * @param confirm Texto digitado no campo de confirmação.
 * @returns Lista vazia enquanto a confirmação está em branco; senão um item que indica se as senhas conferem.
 */
function matchItems(password: string, confirm: string) {
  return confirm ? [{ id: 'match', label: 'As senhas conferem', met: confirm === password }] : []
}

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
        <PasswordField id="password" name="password" autoComplete="current-password" required />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <SubmitButton busy={pending} pending="Entrando…" className="btn-primary w-full">Entrar</SubmitButton>
    </form>
  )
}

export function SignUpForm() {
  const { state, onSubmit, pending } = useFormAction(signUp)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-rules"
        />
        <RuleChecklist id="password-rules" items={evaluatePassword(password)} />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repita a senha</label>
        <PasswordField
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-describedby="confirm-rules"
        />
        <RuleChecklist id="confirm-rules" items={matchItems(password, confirm)} />
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
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormNotice error={state.error} />
      <div>
        <label className="label" htmlFor="password">Nova senha</label>
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-rules"
        />
        <RuleChecklist id="password-rules" items={evaluatePassword(password)} />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repita a nova senha</label>
        <PasswordField
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-describedby="confirm-rules"
        />
        <RuleChecklist id="confirm-rules" items={matchItems(password, confirm)} />
        <FieldError message={state.fieldErrors?.confirm} />
      </div>
      <SubmitButton busy={pending} pending="Salvando…" className="btn-primary w-full">Salvar nova senha</SubmitButton>
    </form>
  )
}
