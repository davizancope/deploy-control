'use client'

import { useFormStatus } from 'react-dom'
import { ENVIRONMENT_LABEL, TYPE_LABEL, type DeployType, type Environment } from '@/lib/types'

/**
 * Botão de envio que desabilita e troca o texto enquanto a Server Action roda.
 * @param props.children Texto normal do botão.
 * @param props.pending Texto exibido durante o envio.
 * @param props.busy Estado de envio vindo de fora (useFormAction); sem ele usa o useFormStatus.
 * @param props.className Classe do botão (btn-primary por padrão).
 * @returns Botão de submit.
 */
export function SubmitButton({
  children,
  pending,
  busy,
  className = 'btn-primary',
}: {
  children: React.ReactNode
  pending?: string
  busy?: boolean
  className?: string
}) {
  const status = useFormStatus()
  const isBusy = busy ?? status.pending
  return (
    <button type="submit" className={className} disabled={isBusy} aria-busy={isBusy}>
      {isBusy ? (pending ?? 'Salvando…') : children}
    </button>
  )
}

/**
 * Mensagem de erro de um campo.
 * @param props.message Texto do erro; nada é renderizado quando vazio.
 * @returns Parágrafo com o erro.
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-sm text-danger">{message}</p>
}

/**
 * Faixa de aviso para erro geral ou confirmação de um formulário.
 * @param props.error Mensagem de erro.
 * @param props.message Mensagem de sucesso.
 * @returns Bloco com role adequado para leitores de tela.
 */
export function FormNotice({ error, message }: { error?: string; message?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
        {error}
      </p>
    )
  if (message)
    return (
      <p role="status" className="rounded-md border border-production/30 bg-production-soft px-3 py-2 text-sm text-ink">
        {message}
      </p>
    )
  return null
}

export { EnvBadge, TypeBadge }

function EnvBadge({ env }: { env: Environment }) {
  const prod = env === 'production'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold ${
        prod ? 'bg-production-soft text-production' : 'bg-staging-soft text-staging'
      }`}
    >
      <EnvMark env={env} />
      {ENVIRONMENT_LABEL[env]}
    </span>
  )
}

/**
 * Marca gráfica do ambiente: círculo vazado para Staging, losango cheio para Produção.
 * @param props.env Ambiente.
 * @returns SVG de 10px.
 */
export function EnvMark({ env }: { env: Environment }) {
  return env === 'production' ? (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M5 0.5 9.5 5 5 9.5 0.5 5z" fill="currentColor" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function TypeBadge({ type }: { type: DeployType }) {
  if (type === 'release') return <span className="text-xs text-muted">{TYPE_LABEL[type]}</span>
  const hot = type === 'hotfix'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
        hot ? 'bg-hotfix-soft text-hotfix' : 'bg-sunken text-ink-2'
      }`}
    >
      {hot ? '⚑' : '•'} {TYPE_LABEL[type]}
    </span>
  )
}
